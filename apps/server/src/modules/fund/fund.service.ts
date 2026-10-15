/**
 * 经费流水与账户。
 *
 * 三条不可退让的规则（开发文档 6.3 / 6.4 节）：
 * 1. **账户余额不存字段**，永远由流水 `SUM(收入) - SUM(支出)` + 期初算出。
 * 2. **流水只能作废，绝不删除**：作废是 `status = 3` + 记 `voidReason`，原记录仍在库里可查，
 *    审计链不断。要冲正就再记一笔反向流水。
 * 3. 金额永远存正数，方向由 `type` 决定，避免「负数支出」这种歧义。
 */
import { Injectable, Logger } from '@nestjs/common';
import {
  BizType,
  ErrorCode,
  FundTransactionStatus,
  FundType,
  FUND_TYPE_LABEL,
  normalizePage,
  skipOf,
  type FundAccountVo,
  type FundCategoryVo,
  type FundOverviewVo,
  type FundTransactionQuery,
  type FundTransactionVo,
} from '@club/shared';
import { BizException } from '../../common/exceptions/biz.exception.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import type { MemberContext } from '../../common/types/member-context.js';
import { parseId } from '../../common/utils/parse-id.js';
import { ApprovalService } from '../approval/approval.service.js';
import type { ApprovableInstance } from '../approval/types/approvable-handler.js';
import { CreateAccountDto, CreateFundCategoryDto, CreateTransactionDto } from './dto/fund.dto.js';

const FUND_TRANSACTION_STATUS_LABEL: Record<number, string> = {
  1: '待审批',
  2: '已入账',
  3: '已作废',
};

@Injectable()
export class FundService {
  private readonly logger = new Logger(FundService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly approval: ApprovalService,
  ) {}

  // ---------------------------------------------------------------------------
  // 账户
  // ---------------------------------------------------------------------------

  /**
   * 账户列表，余额逐个算出来。
   * 不用缓存字段：账实相符是财务系统的底线，宁可每次都算。
   */
  async accounts(me: MemberContext): Promise<FundAccountVo[]> {
    const rows = await this.prisma.client.fundAccount.findMany({
      where: { clubId: me.clubId },
      orderBy: [{ isDefault: 'desc' }, { id: 'asc' }],
    });

    const result: FundAccountVo[] = [];
    for (const row of rows) {
      const [income, expense, count] = await Promise.all([
        this.prisma.client.fundTransaction.aggregate({
          where: {
            accountId: row.id,
            type: FundType.INCOME,
            status: FundTransactionStatus.POSTED,
          },
          _sum: { amount: true },
        }),
        this.prisma.client.fundTransaction.aggregate({
          where: {
            accountId: row.id,
            type: FundType.EXPENSE,
            status: FundTransactionStatus.POSTED,
          },
          _sum: { amount: true },
        }),
        this.prisma.client.fundTransaction.count({ where: { accountId: row.id } }),
      ]);

      const incomeTotal = income._sum.amount ?? 0;
      const expenseTotal = expense._sum.amount ?? 0;
      const initial = row.initialAmount;
      const balance = Number(initial) + Number(incomeTotal) - Number(expenseTotal);

      result.push({
        id: row.id.toString(),
        name: row.name,
        accountNo: row.accountNo,
        initialAmount: initial.toFixed(2),
        balance: balance.toFixed(2),
        incomeTotal: Number(incomeTotal).toFixed(2),
        expenseTotal: Number(expenseTotal).toFixed(2),
        isDefault: row.isDefault,
        status: row.status,
        transactionCount: count,
      });
    }
    return result;
  }

  async createAccount(me: MemberContext, dto: CreateAccountDto): Promise<FundAccountVo> {
    const exists = await this.prisma.client.fundAccount.findFirst({
      where: { clubId: me.clubId, name: dto.name },
      select: { id: true },
    });
    if (exists !== null) throw new BizException(ErrorCode.DUPLICATE_RECORD, `账户「${dto.name}」已存在`);

    if (dto.isDefault === true) {
      await this.prisma.client.fundAccount.updateMany({
        where: { clubId: me.clubId, isDefault: true },
        data: { isDefault: false },
      });
    }

    await this.prisma.client.fundAccount.create({
      data: {
        clubId: me.clubId,
        name: dto.name,
        accountNo: dto.accountNo ?? null,
        initialAmount: (dto.initialAmount ?? 0).toFixed(2),
        isDefault: dto.isDefault ?? false,
        status: 1,
        createdBy: me.userId,
      },
    });

    const all = await this.accounts(me);
    const created = all.find((item) => item.name === dto.name);
    if (created === undefined) throw new BizException(ErrorCode.INTERNAL_ERROR);
    return created;
  }

  // ---------------------------------------------------------------------------
  // 科目
  // ---------------------------------------------------------------------------

  async categories(me: MemberContext): Promise<FundCategoryVo[]> {
    const rows = await this.prisma.client.fundCategory.findMany({
      where: { clubId: me.clubId },
      orderBy: [{ type: 'asc' }, { sort: 'asc' }, { id: 'asc' }],
    });

    const nodes = new Map<string, FundCategoryVo>();
    for (const row of rows) {
      nodes.set(row.id.toString(), {
        id: row.id.toString(),
        parentId: row.parentId?.toString() ?? null,
        name: row.name,
        type: row.type,
        sort: row.sort,
        status: row.status,
        children: [],
      });
    }

    const roots: FundCategoryVo[] = [];
    for (const node of nodes.values()) {
      const parent = node.parentId === null ? undefined : nodes.get(node.parentId);
      if (parent === undefined) roots.push(node);
      else parent.children.push(node);
    }
    return roots;
  }

  async createCategory(me: MemberContext, dto: CreateFundCategoryDto): Promise<FundCategoryVo> {
    const parentId =
      dto.parentId === undefined || dto.parentId === null || dto.parentId === ''
        ? null
        : parseId(dto.parentId);

    const row = await this.prisma.client.fundCategory.create({
      data: {
        clubId: me.clubId,
        parentId,
        name: dto.name,
        type: dto.type,
        sort: dto.sort ?? 0,
        status: 1,
      },
    });
    return {
      id: row.id.toString(),
      parentId: row.parentId?.toString() ?? null,
      name: row.name,
      type: row.type,
      sort: row.sort,
      status: row.status,
      children: [],
    };
  }

  // ---------------------------------------------------------------------------
  // 流水
  // ---------------------------------------------------------------------------

  async transactions(
    me: MemberContext,
    query: FundTransactionQuery,
  ): Promise<{ list: FundTransactionVo[]; total: number; page: number; pageSize: number }> {
    const { page, pageSize } = normalizePage(query);
    const where = this.transactionWhere(me, query);

    const [total, rows] = await Promise.all([
      this.prisma.client.fundTransaction.count({ where }),
      this.prisma.client.fundTransaction.findMany({
        where,
        orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
        skip: skipOf(page, pageSize),
        take: pageSize,
        include: {
          account: { select: { name: true } },
          category: { select: { name: true } },
          handler: { select: { id: true, user: { select: { realName: true } } } },
        },
      }),
    ]);

    // 凭证数量单独聚合，避免为每条流水查一次
    const ids = rows.map((row) => row.id);
    const voucherCounts =
      ids.length === 0
        ? []
        : await this.prisma.client.fundVoucher.groupBy({
            by: ['transactionId'],
            where: { transactionId: { in: ids } },
            _count: { _all: true },
          });
    const voucherMap = new Map(
      voucherCounts.map((item) => [item.transactionId.toString(), item._count._all]),
    );

    return {
      list: rows.map((row) => toTransactionVo(row as never, voucherMap.get(row.id.toString()) ?? 0)),
      total,
      page,
      pageSize,
    };
  }

  private transactionWhere(me: MemberContext, query: FundTransactionQuery): Record<string, unknown> {
    // 财务数据按社团隔离；数据范围约束的是「谁能改」，查看口径统一为社团内可见
    const where: Record<string, unknown> = { clubId: me.clubId };
    if (query.keyword !== undefined && query.keyword !== '') {
      where.title = { contains: query.keyword.trim() };
    }
    if (query.accountId !== undefined && query.accountId !== '') {
      where.accountId = parseId(query.accountId);
    }
    if (query.categoryId !== undefined && query.categoryId !== '') {
      where.categoryId = parseId(query.categoryId);
    }
    if (query.type !== undefined) where.type = query.type;
    if (query.status !== undefined) where.status = query.status;
    if (query.dateFrom !== undefined && query.dateFrom !== '') {
      where.occurredAt = { ...(where.occurredAt as object), gte: new Date(query.dateFrom) };
    }
    if (query.dateTo !== undefined && query.dateTo !== '') {
      where.occurredAt = { ...(where.occurredAt as object), lte: new Date(query.dateTo) };
    }
    return where;
  }

  /**
   * 新增流水。默认直接入账；`needApproval` 为 true 时先提交审批，
   * 审批通过后由经费的 ApprovableHandler 把它置为已入账。
   */
  async createTransaction(
    me: MemberContext,
    dto: CreateTransactionDto,
  ): Promise<FundTransactionVo> {
    const accountId = parseId(dto.accountId);
    const account = await this.prisma.client.fundAccount.findFirst({
      where: { id: accountId, clubId: me.clubId },
      select: { id: true },
    });
    if (account === null) throw new BizException(ErrorCode.NOT_FOUND, '经费账户不存在');

    const categoryId = await this.resolveCategoryId(me, dto.categoryId ?? null, dto.type);
    const handlerMemberId =
      dto.handlerMemberId === undefined || dto.handlerMemberId === null
        ? null
        : parseId(dto.handlerMemberId);
    const termId = await this.currentTermId(me.clubId);

    const needApproval = dto.needApproval ?? false;

    const created = await this.prisma.transaction(async (tx) => {
      const row = await tx.fundTransaction.create({
        data: {
          clubId: me.clubId,
          accountId,
          categoryId,
          termId,
          type: dto.type,
          amount: dto.amount.toFixed(2),
          title: dto.title,
          occurredAt: new Date(dto.occurredAt),
          handlerMemberId,
          // 需要审批时先挂「待审批」，通过后才计入余额
          status: needApproval ? FundTransactionStatus.PENDING : FundTransactionStatus.POSTED,
          remark: dto.remark ?? null,
          createdBy: me.userId,
        },
      });

      if (dto.voucherFileIds !== undefined && dto.voucherFileIds.length > 0) {
        await tx.fundVoucher.createMany({
          data: dto.voucherFileIds.map((fileId, index) => ({
            transactionId: row.id,
            fileId: parseId(fileId),
            sort: index,
          })),
        });
      }
      return row;
    });

    if (needApproval) {
      const instance = await this.approval.submit({
        clubId: me.clubId,
        bizType: BizType.FUND,
        bizId: created.id,
        title: `${FUND_TYPE_LABEL[dto.type as FundType] ?? '经费'}：${dto.title}`,
        applicantMemberId: me.memberId,
        formData: { amount: dto.amount.toFixed(2), account: accountId.toString() },
      });
      await this.prisma.client.fundTransaction.update({
        where: { id: created.id },
        data: { approvalInstanceId: instance.id },
      });
    }

    const row = await this.prisma.client.fundTransaction.findFirstOrThrow({
      where: { id: created.id },
      include: {
        account: { select: { name: true } },
        category: { select: { name: true } },
        handler: { select: { id: true, user: { select: { realName: true } } } },
      },
    });
    return toTransactionVo(row as never, dto.voucherFileIds?.length ?? 0);
  }

  /**
   * 作废流水。**不是删除**：改状态 + 记原因，原记录留在库里。
   * 已作废的不能再作废，也不会再计入余额。
   */
  async voidTransaction(
    me: MemberContext,
    id: bigint,
    reason: string,
  ): Promise<FundTransactionVo> {
    const row = await this.prisma.client.fundTransaction.findFirst({
      where: { id, clubId: me.clubId },
      select: { id: true, status: true },
    });
    if (row === null) throw new BizException(ErrorCode.NOT_FOUND, '流水不存在');
    if (row.status === FundTransactionStatus.VOIDED) {
      throw new BizException(ErrorCode.TRANSACTION_VOIDED);
    }

    await this.prisma.client.fundTransaction.update({
      where: { id },
      data: {
        status: FundTransactionStatus.VOIDED,
        voidReason: reason,
        updatedBy: me.userId,
      },
    });

    this.logger.log(`作废流水 ${id.toString()}：${reason}`);
    const updated = await this.prisma.client.fundTransaction.findFirstOrThrow({
      where: { id },
      include: {
        account: { select: { name: true } },
        category: { select: { name: true } },
        handler: { select: { id: true, user: { select: { realName: true } } } },
      },
    });
    return toTransactionVo(updated as never, 0);
  }

  /** 给流水补凭证 */
  async attachVouchers(me: MemberContext, id: bigint, fileIds: string[]): Promise<{ count: number }> {
    const row = await this.prisma.client.fundTransaction.findFirst({
      where: { id, clubId: me.clubId },
      select: { id: true },
    });
    if (row === null) throw new BizException(ErrorCode.NOT_FOUND, '流水不存在');

    await this.prisma.client.fundVoucher.createMany({
      data: fileIds.map((fileId, index) => ({
        transactionId: id,
        fileId: parseId(fileId),
        sort: index,
      })),
    });
    return { count: fileIds.length };
  }

  // ---------------------------------------------------------------------------
  // 公示页：总览与趋势
  // ---------------------------------------------------------------------------

  async overview(me: MemberContext): Promise<FundOverviewVo> {
    const accounts = await this.accounts(me);

    const totalBalance = accounts.reduce((sum, a) => sum + Number(a.balance), 0);
    const totalIncome = accounts.reduce((sum, a) => sum + Number(a.incomeTotal), 0);
    const totalExpense = accounts.reduce((sum, a) => sum + Number(a.expenseTotal), 0);

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

    const [monthIncome, monthExpense, recent, expenseRows] = await Promise.all([
      this.prisma.client.fundTransaction.aggregate({
        where: {
          clubId: me.clubId,
          type: FundType.INCOME,
          status: FundTransactionStatus.POSTED,
          occurredAt: { gte: monthStart },
        },
        _sum: { amount: true },
      }),
      this.prisma.client.fundTransaction.aggregate({
        where: {
          clubId: me.clubId,
          type: FundType.EXPENSE,
          status: FundTransactionStatus.POSTED,
          occurredAt: { gte: monthStart },
        },
        _sum: { amount: true },
      }),
      // 近 6 个月的全部流水，量很小，取回来在内存里按月聚合比写原生 SQL 更清楚
      this.prisma.client.fundTransaction.findMany({
        where: {
          clubId: me.clubId,
          status: FundTransactionStatus.POSTED,
          occurredAt: { gte: sixMonthsAgo },
        },
        select: { type: true, amount: true, occurredAt: true },
      }),
      this.prisma.client.fundTransaction.findMany({
        where: {
          clubId: me.clubId,
          type: FundType.EXPENSE,
          status: FundTransactionStatus.POSTED,
        },
        select: { amount: true, categoryId: true, category: { select: { name: true } } },
      }),
    ]);

    // 按科目聚合支出
    const byCategory = new Map<string, { categoryId: string | null; categoryName: string; amount: number }>();
    for (const row of expenseRows) {
      const key = row.categoryId?.toString() ?? 'none';
      const current = byCategory.get(key) ?? {
        categoryId: row.categoryId?.toString() ?? null,
        categoryName: row.category?.name ?? '未分类',
        amount: 0,
      };
      current.amount += Number(row.amount);
      byCategory.set(key, current);
    }

    // 近 6 个月趋势
    const monthly = new Map<string, { income: number; expense: number }>();
    for (let i = 5; i >= 0; i -= 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthly.set(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, {
        income: 0,
        expense: 0,
      });
    }
    for (const row of recent) {
      const key = `${row.occurredAt.getFullYear()}-${String(row.occurredAt.getMonth() + 1).padStart(2, '0')}`;
      const bucket = monthly.get(key);
      if (bucket === undefined) continue;
      if (row.type === FundType.INCOME) bucket.income += Number(row.amount);
      else bucket.expense += Number(row.amount);
    }

    return {
      totalBalance: totalBalance.toFixed(2),
      totalIncome: totalIncome.toFixed(2),
      totalExpense: totalExpense.toFixed(2),
      monthIncome: Number(monthIncome._sum.amount ?? 0).toFixed(2),
      monthExpense: Number(monthExpense._sum.amount ?? 0).toFixed(2),
      accounts,
      expenseByCategory: [...byCategory.values()]
        .sort((a, b) => b.amount - a.amount)
        .map((item) => ({ ...item, amount: item.amount.toFixed(2) })),
      monthlyTrend: [...monthly.entries()].map(([month, value]) => ({
        month,
        income: value.income.toFixed(2),
        expense: value.expense.toFixed(2),
      })),
    };
  }

  // ---------------------------------------------------------------------------
  // 审批回调
  // ---------------------------------------------------------------------------

  /** 审批通过：流水由「待审批」转为「已入账」，从这一刻起计入余额 */
  async onApproved(instance: ApprovableInstance): Promise<void> {
    await this.prisma.client.fundTransaction.update({
      where: { id: instance.bizId },
      data: { status: FundTransactionStatus.POSTED },
    });
  }

  /** 驳回：流水留在「待审批」不动，也不计入余额，等申请人改后重提或直接作废 */
  async onRejected(instance: ApprovableInstance, opinion: string): Promise<void> {
    await this.prisma.client.fundTransaction.update({
      where: { id: instance.bizId },
      data: { remark: opinion === '' ? undefined : `【审批驳回】${opinion}` },
    });
  }

  // ---------------------------------------------------------------------------
  // 内部
  // ---------------------------------------------------------------------------

  private async resolveCategoryId(
    me: MemberContext,
    raw: string | null,
    type: number,
  ): Promise<bigint | null> {
    if (raw === null || raw === undefined || raw === '') return null;
    const id = parseId(raw);
    const row = await this.prisma.client.fundCategory.findFirst({
      where: { id, clubId: me.clubId },
      select: { id: true, type: true },
    });
    if (row === null) throw new BizException(ErrorCode.NOT_FOUND, '经费科目不存在');
    if (row.type !== type) {
      throw new BizException(
        ErrorCode.PARAM_INVALID,
        `科目类型与流水方向不一致（该科目是${row.type === 1 ? '收入' : '支出'}科目）`,
      );
    }
    return id;
  }

  private async currentTermId(clubId: bigint): Promise<bigint | null> {
    const term = await this.prisma.client.term.findFirst({
      where: { clubId, isCurrent: true },
      select: { id: true },
    });
    return term?.id ?? null;
  }
}

interface TransactionRow {
  id: bigint;
  accountId: bigint;
  categoryId: bigint | null;
  type: number;
  amount: { toFixed(digits: number): string };
  title: string;
  occurredAt: Date;
  bizType: string | null;
  bizId: bigint | null;
  status: number;
  approvalInstanceId: bigint | null;
  voidReason: string | null;
  remark: string | null;
  createdAt: Date;
  account: { name: string } | null;
  category: { name: string } | null;
  handler: { id: bigint; user: { realName: string } } | null;
}

export function toTransactionVo(row: TransactionRow, voucherCount: number): FundTransactionVo {
  return {
    id: row.id.toString(),
    accountId: row.accountId.toString(),
    accountName: row.account?.name ?? null,
    categoryId: row.categoryId?.toString() ?? null,
    categoryName: row.category?.name ?? null,
    type: row.type,
    typeLabel: FUND_TYPE_LABEL[row.type as FundType] ?? String(row.type),
    amount: row.amount.toFixed(2),
    title: row.title,
    occurredAt: row.occurredAt.toISOString().slice(0, 10),
    bizType: row.bizType,
    bizId: row.bizId?.toString() ?? null,
    handlerName: row.handler?.user.realName ?? null,
    status: row.status,
    statusLabel: FUND_TRANSACTION_STATUS_LABEL[row.status] ?? String(row.status),
    approvalInstanceId: row.approvalInstanceId?.toString() ?? null,
    voidReason: row.voidReason,
    remark: row.remark,
    voucherCount,
    createdAt: row.createdAt.toISOString(),
  };
}
