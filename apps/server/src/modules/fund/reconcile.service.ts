/**
 * 对账：重算所有缓存字段（开发文档 6.3 节）。
 *
 * 这是文档点名的底线能力——所有缓存字段都必须能重算。它既是财务系统的保险，
 * 也是回答「缓存字段和流水不一致怎么办」的答案：
 * 准的永远是流水/明细表，缓存只是加速，随时可以按流水重建。
 *
 * 每张缓存表的「重算逻辑」都复用各自 Service 里的同一个函数，
 * 不在这里另写一套，否则重算本身就会成为新的不一致来源。
 */
import { Injectable, Logger } from '@nestjs/common';
import { ACTIVE_BORROW_STATUSES, type ReconcileResultVo } from '@club/shared';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import type { MemberContext } from '../../common/types/member-context.js';
import { BudgetService } from './budget.service.js';
import { FeeService } from './fee.service.js';

@Injectable()
export class ReconcileService {
  private readonly logger = new Logger(ReconcileService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly budgetService: BudgetService,
    private readonly feeService: FeeService,
  ) {}

  async runAll(me: MemberContext): Promise<ReconcileResultVo> {
    const started = Date.now();

    const [memberPoints, budgetUsed, feeStatus, assetQty] = await Promise.all([
      this.reconcileMemberPoints(me.clubId),
      this.budgetService.recomputeUsed(me.clubId),
      this.feeService.recomputeStatus(me.clubId),
      this.reconcileAssetQty(me.clubId),
    ]);

    const result: ReconcileResultVo & { assetQty: { checked: number; fixed: number; details: string[] } } = {
      memberPoints,
      budgetUsed,
      feeStatus,
      assetQty,
      durationMs: Date.now() - started,
      runAt: new Date().toISOString(),
    };

    this.logger.log(
      `对账完成：成员积分修 ${memberPoints.fixed} 条、预算已用修 ${budgetUsed.fixed} 条、` +
        `会费状态修 ${feeStatus.fixed} 条、物资可借数修 ${assetQty.fixed} 条，耗时 ${result.durationMs}ms`,
    );
    return result;
  }

  /** member.totalPoints 以 point_record 流水为准 */
  async reconcileMemberPoints(
    clubId: bigint,
  ): Promise<{ checked: number; fixed: number; details: string[] }> {
    const members = await this.prisma.client.member.findMany({
      where: { clubId },
      select: {
        id: true,
        totalPoints: true,
        user: { select: { realName: true } },
      },
    });

    let fixed = 0;
    const details: string[] = [];

    for (const member of members) {
      const sum = await this.prisma.client.pointRecord.aggregate({
        where: { memberId: member.id, clubId },
        _sum: { points: true },
      });
      const computed = sum._sum.points ?? 0;
      if (computed !== member.totalPoints) {
        await this.prisma.client.member.update({
          where: { id: member.id },
          data: { totalPoints: computed },
        });
        fixed += 1;
        details.push(`${member.user.realName} 的积分 ${member.totalPoints} → ${computed}`);
      }
    }
    return { checked: members.length, fixed, details };
  }

  /** asset.availableQty 以「总数 - 未归还数量」为准 */
  async reconcileAssetQty(
    clubId: bigint,
  ): Promise<{ checked: number; fixed: number; details: string[] }> {
    const assets = await this.prisma.client.asset.findMany({
      where: { clubId },
      select: { id: true, name: true, totalQty: true, availableQty: true },
    });

    let fixed = 0;
    const details: string[] = [];

    for (const asset of assets) {
      const borrowed = await this.prisma.client.assetBorrow.aggregate({
        where: {
          assetId: asset.id,
          status: { in: [...ACTIVE_BORROW_STATUSES] },
        },
        _sum: { qty: true },
      });
      const computed = Math.max(0, asset.totalQty - Number(borrowed._sum.qty ?? 0));
      if (computed !== asset.availableQty) {
        await this.prisma.client.asset.update({
          where: { id: asset.id },
          data: { availableQty: computed },
        });
        fixed += 1;
        details.push(`${asset.name} 可借数量 ${asset.availableQty} → ${computed}`);
      }
    }
    return { checked: assets.length, fixed, details };
  }
}
