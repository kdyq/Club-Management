/**
 * 预算与执行率。
 *
 * `usedAmount` 是**缓存字段**（schema 里就是这么设计的），准的是流水：
 * - 预算挂了活动 → 统计该活动关联的已入账支出流水
 * - 没挂活动 → 统计同科目、同期间的已入账支出流水
 * 两条口径都由 `computeUsedAmount` 实现，对账接口复用同一个函数重算，
 * 所以缓存永远可以修回来（开发文档 6.3 节）。
 */
import { Injectable } from '@nestjs/common';
import {
  BizType,
  BudgetStatus,
  BUDGET_STATUS_LABEL,
  ErrorCode,
  FundTransactionStatus,
  FundType,
  normalizePage,
  skipOf,
  type FundBudgetQuery,
  type FundBudgetVo,
} from '@club/shared';
import { BizException } from '../../common/exceptions/biz.exception.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import type { MemberContext } from '../../common/types/member-context.js';
import { parseId } from '../../common/utils/parse-id.js';
import { ApprovalService } from '../approval/approval.service.js';
import type { ApprovableInstance } from '../approval/types/approvable-handler.js';
import { CreateBudgetDto } from './dto/fund.dto.js';

interface BudgetRow {
  id: bigint;
  name: string;
  termId: bigint | null;
  activityId: bigint | null;
  categoryId: bigint | null;
  amount: { toString(): string };
  usedAmount: { toString(): string };
  periodStart: Date | null;
  periodEnd: Date | null;
  status: number;
  approvalInstanceId: bigint | null;
  createdAt: Date;
  category: { name: string } | null;
}

@Injectable()
export class BudgetService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly approval: ApprovalService,
  ) {}

  async page(me: MemberContext, query: FundBudgetQuery): Promise<{
    list: FundBudgetVo[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const { page, pageSize } = normalizePage(query);
    const where: Record<string, unknown> = { clubId: me.clubId };
    if (query.keyword !== undefined && query.keyword !== '') {
      where.name = { contains: query.keyword.trim() };
    }
    if (query.status !== undefined) where.status = query.status;
    if (query.activityId !== undefined && query.activityId !== '') {
      where.activityId = parseId(query.activityId);
    }

    const [total, rows] = await Promise.all([
      this.prisma.client.fundBudget.count({ where }),
      this.prisma.client.fundBudget.findMany({
        where,
        orderBy: { id: 'desc' },
        skip: skipOf(page, pageSize),
        take: pageSize,
        include: { category: { select: { name: true } } },
      }),
    ]);

    const list: FundBudgetVo[] = [];
    for (const row of rows) {
      const used = await this.computeUsedAmount(row as BudgetRow);
      list.push(toBudgetVo(row as BudgetRow, used));
    }
    return { list, total, page, pageSize };
  }

  async create(me: MemberContext, dto: CreateBudgetDto): Promise<FundBudgetVo> {
    const termId = await this.currentTermId(me.clubId);
    const categoryId =
      dto.categoryId === undefined || dto.categoryId === null || dto.categoryId === ''
        ? null
        : parseId(dto.categoryId);
    const activityId =
      dto.activityId === undefined || dto.activityId === null || dto.activityId === ''
        ? null
        : parseId(dto.activityId);

    const row = await this.prisma.client.fundBudget.create({
      data: {
        clubId: me.clubId,
        termId,
        activityId,
        categoryId,
        name: dto.name,
        amount: dto.amount.toFixed(2),
        usedAmount: '0.00',
        periodStart: dto.periodStart === undefined ? null : new Date(dto.periodStart),
        periodEnd: dto.periodEnd === undefined ? null : new Date(dto.periodEnd),
        status: BudgetStatus.DRAFT,
      },
      include: { category: { select: { name: true } } },
    });
    return toBudgetVo(row as BudgetRow, 0);
  }

  /** 提交预算审批 */
  async submit(me: MemberContext, id: bigint): Promise<{ approvalInstanceId: string }> {
    const row = await this.loadOwned(me, id);
    if (row.status !== BudgetStatus.DRAFT && row.status !== BudgetStatus.REJECTED) {
      throw new BizException(ErrorCode.STATE_NOT_ALLOWED, '只有草稿或被驳回的预算可以提交审批');
    }

    const instance = await this.approval.submit({
      clubId: me.clubId,
      bizType: BizType.BUDGET,
      bizId: id,
      title: `预算申请：${row.name}`,
      applicantMemberId: me.memberId,
      formData: { amount: row.amount.toString() },
    });

    await this.prisma.client.fundBudget.update({
      where: { id },
      data: { status: BudgetStatus.PENDING, approvalInstanceId: instance.id },
    });
    return { approvalInstanceId: instance.id.toString() };
  }

  async close(me: MemberContext, id: bigint): Promise<FundBudgetVo> {
    const row = await this.loadOwned(me, id);
    const updated = await this.prisma.client.fundBudget.update({
      where: { id },
      data: { status: BudgetStatus.CLOSED },
      include: { category: { select: { name: true } } },
    });
    return toBudgetVo(updated as BudgetRow, await this.computeUsedAmount(row));
  }

  /** 审批通过 */
  async onApproved(instance: ApprovableInstance): Promise<void> {
    await this.prisma.client.fundBudget.update({
      where: { id: instance.bizId },
      data: { status: BudgetStatus.APPROVED },
    });
  }

  async onRejected(instance: ApprovableInstance): Promise<void> {
    await this.prisma.client.fundBudget.update({
      where: { id: instance.bizId },
      data: { status: BudgetStatus.REJECTED },
    });
  }

  /**
   * 由流水算出已用金额。**对账接口也调用它**，保证「缓存」与「重算」是同一套逻辑。
   */
  async computeUsedAmount(row: {
    clubId?: bigint;
    id: bigint;
    activityId: bigint | null;
    categoryId: bigint | null;
    periodStart: Date | null;
    periodEnd: Date | null;
  }): Promise<number> {
    const where: Record<string, unknown> = {
      type: FundType.EXPENSE,
      status: FundTransactionStatus.POSTED,
    };

    if (row.activityId !== null) {
      where.bizType = BizType.ACTIVITY;
      where.bizId = row.activityId;
    } else {
      if (row.categoryId !== null) where.categoryId = row.categoryId;
      if (row.periodStart !== null || row.periodEnd !== null) {
        where.occurredAt = {
          ...(row.periodStart !== null ? { gte: row.periodStart } : {}),
          ...(row.periodEnd !== null ? { lte: row.periodEnd } : {}),
        };
      }
    }

    const sum = await this.prisma.client.fundTransaction.aggregate({
      where,
      _sum: { amount: true },
    });
    return Number(sum._sum.amount ?? 0);
  }

  /** 批量重算并写回缓存字段，供对账使用 */
  async recomputeUsed(clubId: bigint): Promise<{ checked: number; fixed: number; details: string[] }> {
    const rows = await this.prisma.client.fundBudget.findMany({
      where: { clubId },
      select: {
        id: true,
        name: true,
        activityId: true,
        categoryId: true,
        periodStart: true,
        periodEnd: true,
        usedAmount: true,
      },
    });

    let fixed = 0;
    const details: string[] = [];
    for (const row of rows) {
      const computed = await this.computeUsedAmount(row);
      const cached = Number(row.usedAmount);
      if (Math.abs(computed - cached) > 0.001) {
        await this.prisma.client.fundBudget.update({
          where: { id: row.id },
          data: { usedAmount: computed.toFixed(2) },
        });
        fixed += 1;
        details.push(`预算「${row.name}」已用金额 ${cached.toFixed(2)} → ${computed.toFixed(2)}`);
      }
    }
    return { checked: rows.length, fixed, details };
  }

  private async loadOwned(me: MemberContext, id: bigint): Promise<BudgetRow> {
    const row = await this.prisma.client.fundBudget.findFirst({
      where: { id, clubId: me.clubId },
      include: { category: { select: { name: true } } },
    });
    if (row === null) throw new BizException(ErrorCode.NOT_FOUND, '预算不存在');
    return row as BudgetRow;
  }

  private async currentTermId(clubId: bigint): Promise<bigint | null> {
    const term = await this.prisma.client.term.findFirst({
      where: { clubId, isCurrent: true },
      select: { id: true },
    });
    return term?.id ?? null;
  }
}

function toBudgetVo(row: BudgetRow, usedAmount: number): FundBudgetVo {
  const amount = Number(row.amount.toString());
  const rate = amount <= 0 ? 0 : Math.round((usedAmount / amount) * 1000) / 10;
  return {
    id: row.id.toString(),
    name: row.name,
    termId: row.termId?.toString() ?? null,
    activityId: row.activityId?.toString() ?? null,
    categoryId: row.categoryId?.toString() ?? null,
    categoryName: row.category?.name ?? null,
    amount: amount.toFixed(2),
    usedAmount: usedAmount.toFixed(2),
    executionRate: rate,
    periodStart: row.periodStart?.toISOString().slice(0, 10) ?? null,
    periodEnd: row.periodEnd?.toISOString().slice(0, 10) ?? null,
    status: row.status,
    statusLabel: BUDGET_STATUS_LABEL[row.status as BudgetStatus] ?? String(row.status),
    approvalInstanceId: row.approvalInstanceId?.toString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}
