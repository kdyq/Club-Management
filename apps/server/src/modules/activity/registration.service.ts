/**
 * 活动报名。
 *
 * 两处并发要点（开发文档 6.5 节）：
 * 1. 重复报名由唯一索引 `UNIQUE(activity_id, member_id, deleted_at)` 兜底，
 *    应用层「先查再插」在并发下必然失效，所以这里捕获 P2002 转成可读提示。
 * 2. 报名超额唯一索引覆盖不到，必须在事务里 `SELECT ... FOR UPDATE` 锁住活动行，
 *    否则两个人同时抢最后一个名额都会通过。
 */
import { Injectable, Logger } from '@nestjs/common';
import {
  ActivityStatus,
  ActivityStatus as ActivityStatusEnum,
  ACTIVITY_STATUS_LABEL,
  CheckinStatus,
  ErrorCode,
  RegistrationStatus,
  REGISTRATION_STATUS_LABEL,
  normalizePage,
  skipOf,
  type CheckinStatus as CheckinStatusType,
  type PageResult,
  type RegistrationQuery,
  type RegistrationVo,
} from '@club/shared';
import { BizException } from '../../common/exceptions/biz.exception.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import type { MemberContext } from '../../common/types/member-context.js';
import { parseId } from '../../common/utils/parse-id.js';
import { ActivityService } from './activity.service.js';
import type { AuditRegistrationDto, RegisterActivityDto } from './dto/activity.dto.js';

/** 允许报名的状态 */
const REGISTRABLE_STATUSES = new Set<number>([
  ActivityStatus.REGISTERING,
  ActivityStatus.ONGOING,
]);

@Injectable()
export class RegistrationService {
  private readonly logger = new Logger(RegistrationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly activityService: ActivityService,
  ) {}

  // ---------------------------------------------------------------------------
  // 报名
  // ---------------------------------------------------------------------------

  async register(
    me: MemberContext,
    activityId: bigint,
    dto: RegisterActivityDto,
  ): Promise<{ id: string; status: number; message: string }> {
    await this.activityService.assertActiveMember(me.clubId, me.memberId);
    const activity = await this.activityService.loadActivityForCheckin(me.clubId, activityId);

    if (!REGISTRABLE_STATUSES.has(activity.status)) {
      throw new BizException(
        ErrorCode.STATE_NOT_ALLOWED,
        `当前状态为「${ACTIVITY_STATUS_LABEL[activity.status as ActivityStatusEnum] ?? activity.status}」，暂不能报名`,
      );
    }

    const now = new Date();
    const result = await this.prisma.transaction(async (tx) => {
      // 锁住活动行，把「数人数 + 插入」串行化；不锁的话并发下会超员
      await tx.$queryRaw`SELECT id FROM activity WHERE id = ${activityId} FOR UPDATE`;

      const approved = await tx.activityRegistration.count({
        where: { activityId, status: RegistrationStatus.APPROVED },
      });
      const pending = await tx.activityRegistration.count({
        where: { activityId, status: RegistrationStatus.PENDING },
      });

      // 需要审核时，待审核的也算占位，否则会超卖
      const occupied = activity.needAudit ? approved + pending : approved;
      if (activity.capacity > 0 && occupied >= activity.capacity) {
        throw new BizException(ErrorCode.ACTIVITY_FULL, `名额已满（${activity.capacity} 人）`);
      }

      const status = activity.needAudit ? RegistrationStatus.PENDING : RegistrationStatus.APPROVED;

      const created = await tx.activityRegistration.create({
        data: {
          clubId: me.clubId,
          activityId,
          memberId: me.memberId,
          userId: me.userId,
          applyAt: now,
          status,
          remark: dto.remark ?? null,
        },
      });

      // 免审核时同步建签到占位记录，签到页直接更新它，避免签到环节再判一次报名
      if (status === RegistrationStatus.APPROVED) {
        await tx.activityCheckin.create({
          data: {
            clubId: me.clubId,
            activityId,
            registrationId: created.id,
            memberId: me.memberId,
            checkinType: activity.checkinType,
            status: CheckinStatus.ABSENT,
          },
        });
      }

      return { id: created.id, status };
    });

    return {
      id: result.id.toString(),
      status: result.status,
      message:
        result.status === RegistrationStatus.PENDING
          ? '报名已提交，等待审核'
          : '报名成功，请按时参加',
    };
  }

  /** 取消报名 */
  async cancel(me: MemberContext, registrationId: bigint): Promise<void> {
    const row = await this.prisma.client.activityRegistration.findFirst({
      where: { id: registrationId, clubId: me.clubId },
      select: { id: true, memberId: true, status: true, activityId: true },
    });
    if (row === null) throw new BizException(ErrorCode.NOT_FOUND, '报名记录不存在');
    if (row.memberId !== me.memberId) {
      throw new BizException(ErrorCode.FORBIDDEN, '只能取消自己的报名');
    }
    if (row.status === RegistrationStatus.CANCELLED) return;

    await this.prisma.transaction(async (tx) => {
      await tx.activityRegistration.update({
        where: { id: registrationId },
        data: { status: RegistrationStatus.CANCELLED },
      });
      // 占位的签到记录一并删掉，否则会一直算在「已报名未签到」里
      await tx.activityCheckin.deleteMany({ where: { registrationId } });
    });
  }

  // ---------------------------------------------------------------------------
  // 审核
  // ---------------------------------------------------------------------------

  async audit(
    me: MemberContext,
    registrationId: bigint,
    dto: AuditRegistrationDto,
  ): Promise<RegistrationVo> {
    const row = await this.prisma.client.activityRegistration.findFirst({
      where: { id: registrationId, clubId: me.clubId },
      select: { id: true, activityId: true, memberId: true, status: true },
    });
    if (row === null) throw new BizException(ErrorCode.NOT_FOUND, '报名记录不存在');
    if (row.status !== RegistrationStatus.PENDING) {
      throw new BizException(
        ErrorCode.STATE_NOT_ALLOWED,
        `该报名已经是「${REGISTRATION_STATUS_LABEL[row.status as RegistrationStatus] ?? row.status}」`,
      );
    }
    if (!dto.approved && (dto.remark === undefined || dto.remark.trim() === '')) {
      throw new BizException(ErrorCode.PARAM_INVALID, '拒绝报名时需要填写原因');
    }

    const activity = await this.activityService.loadActivityForCheckin(me.clubId, row.activityId);

    await this.prisma.transaction(async (tx) => {
      await tx.activityRegistration.update({
        where: { id: registrationId },
        data: {
          status: dto.approved ? RegistrationStatus.APPROVED : RegistrationStatus.REJECTED,
          auditBy: me.memberId,
          auditAt: new Date(),
          auditRemark: dto.remark ?? null,
        },
      });

      if (dto.approved && row.memberId !== null) {
        // 通过审核后才建签到占位；这里再锁一次活动行，防止审核通过把名额撑破
        await tx.$queryRaw`SELECT id FROM activity WHERE id = ${row.activityId} FOR UPDATE`;
        const approvedCount = await tx.activityRegistration.count({
          where: { activityId: row.activityId, status: RegistrationStatus.APPROVED },
        });
        if (activity.capacity > 0 && approvedCount > activity.capacity) {
          throw new BizException(
            ErrorCode.ACTIVITY_FULL,
            `通过后人数将超过上限 ${activity.capacity}，请先拒绝其它待审报名`,
          );
        }

        const existing = await tx.activityCheckin.findFirst({
          where: { activityId: row.activityId, memberId: row.memberId },
          select: { id: true },
        });
        if (existing === null) {
          await tx.activityCheckin.create({
            data: {
              clubId: me.clubId,
              activityId: row.activityId,
              registrationId,
              memberId: row.memberId,
              checkinType: activity.checkinType,
              status: CheckinStatus.ABSENT,
            },
          });
        }
      }
    });

    return this.loadRegistrationVo(me, registrationId);
  }

  /** 批量审核：把当前活动的待审报名一次通过 */
  async auditAll(me: MemberContext, activityId: bigint): Promise<{ approved: number }> {
    await this.activityService.loadActivityForCheckin(me.clubId, activityId);
    const pending = await this.prisma.client.activityRegistration.findMany({
      where: { activityId, status: RegistrationStatus.PENDING },
      select: { id: true },
    });

    let approved = 0;
    for (const row of pending) {
      try {
        await this.audit(me, row.id, { approved: true });
        approved += 1;
      } catch (error) {
        // 名额满时后面的会被拒绝，这是预期行为，不该让整批失败
        this.logger.warn(
          `批量审核跳过报名 ${row.id.toString()}：${error instanceof Error ? error.message : String(error)}`,
        );
        break;
      }
    }
    return { approved };
  }

  // ---------------------------------------------------------------------------
  // 查询
  // ---------------------------------------------------------------------------

  async page(me: MemberContext, query: RegistrationQuery): Promise<PageResult<RegistrationVo>> {
    const { page, pageSize } = normalizePage(query);

    // 报名数据跟着活动走：先取当前用户可见的活动 id（数据范围在这里生效）
    const visibleActivityIds = await this.visibleActivityIds(me, query.activityId);

    const filters: Record<string, unknown> = { activityId: { in: visibleActivityIds } };
    if (query.status !== undefined) filters.status = query.status;
    if (query.keyword !== undefined && query.keyword !== '') {
      const keyword = query.keyword.trim();
      filters.OR = [
        { member: { user: { realName: { contains: keyword } } } },
        { guestName: { contains: keyword } },
        { activity: { title: { contains: keyword } } },
      ];
    }

    const [total, rows] = await Promise.all([
      this.prisma.client.activityRegistration.count({ where: filters }),
      this.prisma.client.activityRegistration.findMany({
        where: filters,
        orderBy: [{ status: 'asc' }, { applyAt: 'desc' }],
        skip: skipOf(page, pageSize),
        take: pageSize,
        include: {
          activity: { select: { id: true, title: true } },
          member: {
            select: {
              id: true,
              user: { select: { realName: true } },
              dept: { select: { name: true } },
            },
          },
          checkin: { select: { checkinTime: true, status: true } },
        },
      }),
    ]);

    return {
      list: rows.map((row) => ({
        id: row.id.toString(),
        activityId: row.activityId.toString(),
        activityTitle: row.activity.title,
        memberId: row.memberId?.toString() ?? null,
        memberName: row.member?.user.realName ?? row.guestName ?? '—',
        deptName: row.member?.dept?.name ?? null,
        guestName: row.guestName,
        guestPhone: row.guestPhone,
        applyAt: row.applyAt.toISOString(),
        status: row.status,
        statusLabel: REGISTRATION_STATUS_LABEL[row.status as RegistrationStatus] ?? String(row.status),
        auditRemark: row.auditRemark,
        remark: row.remark,
        checkedIn: row.checkin?.checkinTime !== null && row.checkin?.checkinTime !== undefined,
        checkinStatus: row.checkin?.status ?? null,
      })),
      total,
      page,
      pageSize,
    };
  }

  /** 报名数据是管理视角，按数据范围限制在「我管得到的活动」上 */
  async visibleActivityIds(me: MemberContext, activityId?: string): Promise<bigint[]> {
    if (activityId !== undefined && activityId !== '') {
      return [parseId(activityId)];
    }
    const managedWhere = await this.activityService.buildManagedWhere(me);
    const rows = await this.prisma.client.activity.findMany({
      where: managedWhere,
      select: { id: true },
    });
    return rows.map((row) => row.id);
  }

  private async loadRegistrationVo(me: MemberContext, id: bigint): Promise<RegistrationVo> {
    const row = await this.prisma.client.activityRegistration.findFirstOrThrow({
      where: { id },
      include: {
        activity: { select: { id: true, title: true } },
        member: {
          select: { id: true, user: { select: { realName: true } }, dept: { select: { name: true } } },
        },
        checkin: { select: { checkinTime: true, status: true } },
      },
    });

    void me;
    return {
      id: row.id.toString(),
      activityId: row.activityId.toString(),
      activityTitle: row.activity.title,
      memberId: row.memberId?.toString() ?? null,
      memberName: row.member?.user.realName ?? row.guestName ?? '—',
      deptName: row.member?.dept?.name ?? null,
      guestName: row.guestName,
      guestPhone: row.guestPhone,
      applyAt: row.applyAt.toISOString(),
      status: row.status,
      statusLabel: REGISTRATION_STATUS_LABEL[row.status as RegistrationStatus] ?? String(row.status),
      auditRemark: row.auditRemark,
      remark: row.remark,
      checkedIn: row.checkin?.checkinTime !== null && row.checkin?.checkinTime !== undefined,
      checkinStatus: (row.checkin?.status ?? null) as CheckinStatusType | null,
    };
  }
}
