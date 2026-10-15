/**
 * 会费。
 *
 * 闭环：建标准（生成应缴名单）→ 登记缴费 → **自动派生一笔收入流水** → 欠费统计与催缴。
 *
 * 缴费登记与收入流水在同一个事务里，两者要么都成，要么都不成——
 * 否则会出现「收了钱但账上没有」或者反过来，财务上这是不能接受的。
 */
import { Injectable, Logger } from '@nestjs/common';
import {
  BizType,
  ErrorCode,
  FeeStatus,
  FEE_STATUS_LABEL,
  FundTransactionStatus,
  FundType,
  NotificationType,
  normalizePage,
  skipOf,
  type CreateFeeStandardDto,
  type FeeQuery,
  type FeeStandardVo,
  type MemberFeeVo,
  type PayFeeDto,
} from '@club/shared';
import { BizException } from '../../common/exceptions/biz.exception.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import type { MemberContext } from '../../common/types/member-context.js';
import { parseId } from '../../common/utils/parse-id.js';
import { NotificationService } from '../notification/notification.service.js';

const PAY_METHOD_LABEL: Record<number, string> = {
  1: '现金',
  2: '微信',
  3: '支付宝',
  4: '银行转账',
};

/** 三种目标范围的说明，导出与提示文案共用 */
const TARGET_TYPE_LABEL: Record<number, string> = {
  1: '全体成员',
  2: '指定部门',
  3: '指定成员',
};

@Injectable()
export class FeeService {
  private readonly logger = new Logger(FeeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notification: NotificationService,
  ) {}

  // ---------------------------------------------------------------------------
  // 会费标准
  // ---------------------------------------------------------------------------

  async standards(me: MemberContext): Promise<FeeStandardVo[]> {
    const rows = await this.prisma.client.memberFeeStandard.findMany({
      where: { clubId: me.clubId },
      orderBy: { id: 'desc' },
      include: { term: { select: { name: true } } },
    });

    const result: FeeStandardVo[] = [];
    for (const row of rows) {
      const fees = await this.prisma.client.memberFee.findMany({
        where: { feeStandardId: row.id },
        select: { status: true, shouldAmount: true, paidAmount: true },
      });
      const paidCount = fees.filter((f) => f.status === FeeStatus.PAID || f.status === FeeStatus.WAIVED).length;
      result.push({
        id: row.id.toString(),
        name: row.name,
        termId: row.termId.toString(),
        termName: row.term.name,
        amount: Number(row.amount).toFixed(2),
        dueDate: row.dueDate.toISOString().slice(0, 10),
        targetType: row.targetType,
        targetTypeLabel: TARGET_TYPE_LABEL[row.targetType] ?? String(row.targetType),
        status: row.status,
        totalCount: fees.length,
        paidCount,
        paidAmount: fees.reduce((sum, f) => sum + Number(f.paidAmount), 0).toFixed(2),
        shouldAmount: fees.reduce((sum, f) => sum + Number(f.shouldAmount), 0).toFixed(2),
      });
    }
    return result;
  }

  /**
   * 建会费标准并**生成应缴名单**。
   * 目标是全体时把当前届次所有在册成员都纳入；指定部门/成员时按 ids 过滤。
   */
  async createStandard(me: MemberContext, dto: CreateFeeStandardDto): Promise<FeeStandardVo> {
    const termId =
      dto.termId === undefined || dto.termId === ''
        ? await this.currentTermId(me.clubId)
        : parseId(dto.termId);

    const targetType = dto.targetType ?? 1;
    const targetIds = dto.targetIds ?? [];

    if (targetType !== 1 && targetIds.length === 0) {
      throw new BizException(ErrorCode.PARAM_INVALID, '指定部门或指定成员时必须提供目标 id 列表');
    }

    // 找出应缴的成员：必须是当前届次的在册成员
    const memberWhere: Record<string, unknown> = {
      clubId: me.clubId,
      termId,
      status: 1,
    };
    if (targetType === 2) {
      memberWhere.deptId = { in: targetIds.map((id) => parseId(id)) };
    } else if (targetType === 3) {
      memberWhere.id = { in: targetIds.map((id) => parseId(id)) };
    }

    const members = await this.prisma.client.member.findMany({
      where: memberWhere,
      select: { id: true },
    });
    if (members.length === 0) {
      throw new BizException(ErrorCode.BUSINESS_RULE_VIOLATED, '按该范围没有找到任何应缴成员');
    }

    const created = await this.prisma.transaction(async (tx) => {
      const standard = await tx.memberFeeStandard.create({
        data: {
          clubId: me.clubId,
          termId,
          name: dto.name,
          amount: dto.amount.toFixed(2),
          dueDate: new Date(dto.dueDate),
          targetType,
          targetIds: targetIds.length === 0 ? undefined : (targetIds as never),
          status: 1,
        },
      });

      await tx.memberFee.createMany({
        data: members.map((member) => ({
          clubId: me.clubId,
          feeStandardId: standard.id,
          memberId: member.id,
          shouldAmount: dto.amount.toFixed(2),
          paidAmount: '0.00',
          status: FeeStatus.UNPAID,
        })),
      });

      return standard;
    });

    this.logger.log(`会费标准「${dto.name}」生成了 ${members.length} 条应缴记录`);

    const all = await this.standards(me);
    const vo = all.find((item) => item.id === created.id.toString());
    if (vo === undefined) throw new BizException(ErrorCode.INTERNAL_ERROR);
    return vo;
  }

  // ---------------------------------------------------------------------------
  // 应缴明细
  // ---------------------------------------------------------------------------

  async fees(me: MemberContext, query: FeeQuery): Promise<{
    list: MemberFeeVo[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const { page, pageSize } = normalizePage(query);
    const where: Record<string, unknown> = { clubId: me.clubId };
    if (query.feeStandardId !== undefined && query.feeStandardId !== '') {
      where.feeStandardId = parseId(query.feeStandardId);
    }
    if (query.memberId !== undefined && query.memberId !== '') {
      where.memberId = parseId(query.memberId);
    }
    if (query.status !== undefined) where.status = query.status;
    if (query.keyword !== undefined && query.keyword !== '') {
      where.member = { user: { realName: { contains: query.keyword.trim() } } };
    }

    const [total, rows] = await Promise.all([
      this.prisma.client.memberFee.count({ where }),
      this.prisma.client.memberFee.findMany({
        where,
        orderBy: [{ status: 'asc' }, { id: 'desc' }],
        skip: skipOf(page, pageSize),
        take: pageSize,
        include: {
          standard: { select: { name: true, dueDate: true } },
          member: {
            select: {
              id: true,
              user: { select: { realName: true } },
              dept: { select: { name: true } },
            },
          },
        },
      }),
    ]);

    return { list: rows.map((row) => toFeeVo(row as never)), total, page, pageSize };
  }

  /**
   * 登记缴费。
   * 关键点：**同时派生一笔收入流水**，两者在同一事务内。
   * 这样账户余额是由流水汇总出来的，缴费记录与账面天然一致。
   */
  async pay(
    me: MemberContext,
    feeId: bigint,
    dto: PayFeeDto,
  ): Promise<{ fee: MemberFeeVo; transactionId: string | null }> {
    const fee = await this.prisma.client.memberFee.findFirst({
      where: { id: feeId, clubId: me.clubId },
      include: {
        standard: { select: { name: true, dueDate: true } },
        member: { select: { id: true, user: { select: { realName: true } } } },
      },
    });
    if (fee === null) throw new BizException(ErrorCode.NOT_FOUND, '应缴记录不存在');
    if (fee.status === FeeStatus.WAIVED) {
      throw new BizException(ErrorCode.STATE_NOT_ALLOWED, '该成员已减免，无需缴费');
    }
    if (fee.status === FeeStatus.PAID) {
      throw new BizException(ErrorCode.STATE_NOT_ALLOWED, '该成员已经缴清了');
    }

    const paidTotal = Number(fee.paidAmount) + dto.paidAmount;
    const should = Number(fee.shouldAmount);
    if (paidTotal - should > 0.001) {
      throw new BizException(
        ErrorCode.PARAM_INVALID,
        `本次缴纳后金额将超过应缴额（应缴 ${should.toFixed(2)}，已缴 ${Number(fee.paidAmount).toFixed(2)}）`,
      );
    }

    const nextStatus = paidTotal + 0.001 >= should ? FeeStatus.PAID : FeeStatus.PARTIAL;
    const createTransaction = dto.createTransaction ?? true;

    const transactionId = await this.prisma.transaction(async (tx) => {
      await tx.memberFee.update({
        where: { id: feeId },
        data: {
          paidAmount: paidTotal.toFixed(2),
          paidAt: new Date(),
          payMethod: dto.payMethod,
          voucherFileId:
            dto.voucherFileId === undefined || dto.voucherFileId === '' ? undefined : parseId(dto.voucherFileId),
          status: nextStatus,
          operatorMemberId: me.memberId,
          remark: dto.remark ?? fee.remark,
        },
      });

      if (!createTransaction) return null;

      // 必须有一个默认账户才能派生流水；没有就明确报错，不要静默跳过
      const account = await tx.fundAccount.findFirst({
        where: { clubId: me.clubId, status: 1 },
        orderBy: [{ isDefault: 'desc' }, { id: 'asc' }],
        select: { id: true },
      });
      if (account === null) {
        throw new BizException(
          ErrorCode.BUSINESS_RULE_VIOLATED,
          '还没有可用的经费账户，无法派生收入流水。请先创建账户，或取消勾选「同时生成流水」',
        );
      }

      const category = await tx.fundCategory.findFirst({
        where: { clubId: me.clubId, type: FundType.INCOME, name: { contains: '会费' } },
        select: { id: true },
      });

      const txn = await tx.fundTransaction.create({
        data: {
          clubId: me.clubId,
          accountId: account.id,
          categoryId: category?.id ?? null,
          termId: fee.standard === null ? null : await this.currentTermId(me.clubId),
          type: FundType.INCOME,
          amount: dto.paidAmount.toFixed(2),
          title: `${fee.standard.name} · ${fee.member.user.realName}`,
          occurredAt: new Date(),
          // 会费入账是既成事实，直接已入账；需要审批的场景走 needApproval 的普通流水
          status: FundTransactionStatus.POSTED,
          bizType: BizType.FEE,
          bizId: feeId,
          handlerMemberId: me.memberId,
          remark: dto.remark ?? `会费缴纳（${PAY_METHOD_LABEL[dto.payMethod] ?? dto.payMethod}）`,
          createdBy: me.userId,
        },
      });

      return txn.id;
    });

    const updated = await this.prisma.client.memberFee.findFirstOrThrow({
      where: { id: feeId },
      include: {
        standard: { select: { name: true, dueDate: true } },
        member: {
          select: {
            id: true,
            user: { select: { realName: true } },
            dept: { select: { name: true } },
          },
        },
      },
    });

    return {
      fee: toFeeVo(updated as never),
      transactionId: transactionId?.toString() ?? null,
    };
  }

  async waive(me: MemberContext, feeId: bigint, reason: string): Promise<MemberFeeVo> {
    const fee = await this.prisma.client.memberFee.findFirst({
      where: { id: feeId, clubId: me.clubId },
      select: { id: true, status: true },
    });
    if (fee === null) throw new BizException(ErrorCode.NOT_FOUND, '应缴记录不存在');
    if (fee.status === FeeStatus.PAID) {
      throw new BizException(ErrorCode.STATE_NOT_ALLOWED, '已缴清的记录不能减免');
    }

    const updated = await this.prisma.client.memberFee.update({
      where: { id: feeId },
      data: { status: FeeStatus.WAIVED, remark: reason, operatorMemberId: me.memberId },
      include: {
        standard: { select: { name: true, dueDate: true } },
        member: {
          select: {
            id: true,
            user: { select: { realName: true } },
            dept: { select: { name: true } },
          },
        },
      },
    });
    return toFeeVo(updated as never);
  }

  // ---------------------------------------------------------------------------
  // 欠费统计与催缴
  // ---------------------------------------------------------------------------

  async arrears(
    me: MemberContext,
    feeStandardId?: string,
  ): Promise<{
    totalMembers: number;
    unpaidCount: number;
    partialCount: number;
    paidCount: number;
    waivedCount: number;
    shouldTotal: string;
    paidTotal: string;
    outstandingTotal: string;
  }> {
    const where: Record<string, unknown> = { clubId: me.clubId };
    if (feeStandardId !== undefined && feeStandardId !== '') {
      where.feeStandardId = parseId(feeStandardId);
    }

    const rows = await this.prisma.client.memberFee.findMany({
      where,
      select: { status: true, shouldAmount: true, paidAmount: true },
    });

    const count = (status: number): number => rows.filter((r) => r.status === status).length;
    const sum = (pick: (r: (typeof rows)[number]) => number): number =>
      rows.reduce((total, row) => total + pick(row), 0);

    const shouldTotal = sum((r) => Number(r.shouldAmount));
    const paidTotal = sum((r) => Number(r.paidAmount));

    return {
      totalMembers: rows.length,
      unpaidCount: count(FeeStatus.UNPAID),
      partialCount: count(FeeStatus.PARTIAL),
      paidCount: count(FeeStatus.PAID),
      waivedCount: count(FeeStatus.WAIVED),
      shouldTotal: shouldTotal.toFixed(2),
      paidTotal: paidTotal.toFixed(2),
      outstandingTotal: Math.max(0, shouldTotal - paidTotal).toFixed(2),
    };
  }

  /**
   * 催缴：给欠费成员发站内信。
   * 幂等键用 `fee_remind` + 会费标准 id，所以同一次催缴重复点不会重复发。
   */
  async remind(
    me: MemberContext,
    feeStandardId: bigint,
  ): Promise<{ notified: number; skipped: boolean }> {
    const standard = await this.prisma.client.memberFeeStandard.findFirst({
      where: { id: feeStandardId, clubId: me.clubId },
      select: { id: true, name: true, dueDate: true },
    });
    if (standard === null) throw new BizException(ErrorCode.NOT_FOUND, '会费标准不存在');

    const unpaid = await this.prisma.client.memberFee.findMany({
      where: {
        feeStandardId,
        status: { in: [FeeStatus.UNPAID, FeeStatus.PARTIAL] },
      },
      include: { member: { select: { userId: true, user: { select: { realName: true } } } } },
    });
    if (unpaid.length === 0) return { notified: 0, skipped: false };

    const result = await this.notification.send({
      clubId: me.clubId,
      title: `会费缴纳提醒：${standard.name}`,
      content:
        `你的「${standard.name}」尚未缴清，请在 ${standard.dueDate.toISOString().slice(0, 10)} 前完成缴纳。` +
        `如有疑问请联系秘书处。`,
      type: NotificationType.FINANCE,
      // 幂等键：同一份会费标准的催缴只发一次
      bizType: 'fee_remind',
      bizId: standard.id,
      senderMemberId: me.memberId,
      receiverUserIds: unpaid.map((fee) => fee.member.userId),
    });

    return { notified: result.receivers, skipped: result.receivers === 0 };
  }

  // ---------------------------------------------------------------------------
  // 对账
  // ---------------------------------------------------------------------------

  /**
   * 重算会费状态。缴费登记与流水在同一个事务里，正常不会不一致；
   * 万一有历史脏数据（例如绕过接口直接改库），这里能修回来。
   */
  async recomputeStatus(clubId: bigint): Promise<{
    checked: number;
    fixed: number;
    details: string[];
  }> {
    const rows = await this.prisma.client.memberFee.findMany({
      where: { clubId },
      select: {
        id: true,
        shouldAmount: true,
        paidAmount: true,
        status: true,
        member: { select: { user: { select: { realName: true } } } },
      },
    });

    let fixed = 0;
    const details: string[] = [];
    for (const row of rows) {
      if (row.status === FeeStatus.WAIVED) continue;

      const should = Number(row.shouldAmount);
      const paid = Number(row.paidAmount);
      let expected: number;
      if (paid <= 0) expected = FeeStatus.UNPAID;
      else if (paid + 0.001 >= should) expected = FeeStatus.PAID;
      else expected = FeeStatus.PARTIAL;

      if (expected !== row.status) {
        await this.prisma.client.memberFee.update({
          where: { id: row.id },
          data: { status: expected },
        });
        fixed += 1;
        details.push(
          `${row.member.user.realName} 的会费状态 ${FEE_STATUS_LABEL[row.status as FeeStatus] ?? row.status} → ${FEE_STATUS_LABEL[expected as FeeStatus]}`,
        );
      }
    }
    return { checked: rows.length, fixed, details };
  }

  private async currentTermId(clubId: bigint): Promise<bigint> {
    const term = await this.prisma.client.term.findFirst({
      where: { clubId, isCurrent: true },
      select: { id: true },
    });
    if (term === null) throw new BizException(ErrorCode.NOT_FOUND, '还没有设置当前届次');
    return term.id;
  }
}

interface FeeRow {
  id: bigint;
  feeStandardId: bigint;
  memberId: bigint;
  shouldAmount: { toString(): string };
  paidAmount: { toString(): string };
  paidAt: Date | null;
  payMethod: number | null;
  status: number;
  remark: string | null;
  standard: { name: string; dueDate: Date };
  member: {
    id: bigint;
    user: { realName: string };
    dept: { name: string } | null;
  };
}

function toFeeVo(row: FeeRow): MemberFeeVo {
  return {
    id: row.id.toString(),
    feeStandardId: row.feeStandardId.toString(),
    standardName: row.standard.name,
    memberId: row.memberId.toString(),
    memberName: row.member.user.realName,
    deptName: row.member.dept?.name ?? null,
    shouldAmount: Number(row.shouldAmount).toFixed(2),
    paidAmount: Number(row.paidAmount).toFixed(2),
    paidAt: row.paidAt?.toISOString() ?? null,
    payMethod: row.payMethod,
    payMethodLabel: row.payMethod === null ? null : (PAY_METHOD_LABEL[row.payMethod] ?? String(row.payMethod)),
    status: row.status,
    statusLabel: FEE_STATUS_LABEL[row.status as FeeStatus] ?? String(row.status),
    remark: row.remark,
    dueDate: row.standard.dueDate.toISOString().slice(0, 10),
  };
}
