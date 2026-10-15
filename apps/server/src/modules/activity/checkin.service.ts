/**
 * 签到。
 *
 * 口令由服务端时间片算出（见 ActivityService.checkinToken），客户端只做展示，
 * 因此手机时钟不准不会导致签到失败——这是开发文档 15.1 节点名的风险项。
 *
 * 重复签到由唯一索引 `UNIQUE(activity_id, member_id, deleted_at)` 兜底。
 */
import { Injectable } from '@nestjs/common';
import {
  ActivityStatus,
  CheckinStatus,
  CHECKIN_STATUS_LABEL,
  CHECKIN_TYPE_LABEL,
  CheckinType,
  ErrorCode,
  RegistrationStatus,
  normalizePage,
  skipOf,
  type CheckinStatus as CheckinStatusValue,
  type CheckinType as CheckinTypeValue,
  type CheckinVo,
  type PageResult,
  type RegistrationQuery,
} from '@club/shared';
import { BizException } from '../../common/exceptions/biz.exception.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import type { MemberContext } from '../../common/types/member-context.js';
import { parseId } from '../../common/utils/parse-id.js';
import { ActivityService } from './activity.service.js';

/** 允许签到的活动状态 */
const CHECKINABLE = new Set<number>([ActivityStatus.ONGOING, ActivityStatus.REGISTERING, ActivityStatus.REGISTRATION_CLOSED]);

@Injectable()
export class CheckinService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityService: ActivityService,
  ) {}

  /**
   * 成员自助签到。三种方式共用这一个入口：
   * 二维码与口令都是校验时间片 token，位置围栏只做记录不做拦截（室内定位偏差大）。
   */
  async checkin(
    me: MemberContext,
    activityId: bigint,
    token: string,
  ): Promise<{ checkinTime: string; status: number; statusLabel: string }> {
    const activity = await this.activityService.loadActivityForCheckin(me.clubId, activityId);

    if (!CHECKINABLE.has(activity.status)) {
      throw new BizException(ErrorCode.STATE_NOT_ALLOWED, '当前活动不在可签到状态');
    }

    const now = new Date();
    if (activity.checkinStart !== null && now < activity.checkinStart) {
      throw new BizException(ErrorCode.STATE_NOT_ALLOWED, '签到尚未开始');
    }
    if (activity.checkinEnd !== null && now > activity.checkinEnd) {
      throw new BizException(ErrorCode.STATE_NOT_ALLOWED, '签到已经结束，请联系管理员代签');
    }

    if (activity.checkinType === CheckinType.ADMIN) {
      throw new BizException(ErrorCode.STATE_NOT_ALLOWED, '该活动只支持管理员代签');
    }

    const secret = activity.qrSecret;
    if (secret === null) {
      throw new BizException(ErrorCode.STATE_NOT_ALLOWED, '活动还未生成签到口令');
    }
    if (!this.activityService.verifyCheckinToken(activityId, secret, activity.qrRefreshSec, token.trim())) {
      throw new BizException(
        ErrorCode.STATE_NOT_ALLOWED,
        '签到口令不正确或已过期，请刷新二维码后重试',
      );
    }

    const registration = await this.prisma.client.activityRegistration.findFirst({
      where: { activityId, memberId: me.memberId },
      select: { id: true, status: true },
    });
    if (registration === null || registration.status !== RegistrationStatus.APPROVED) {
      throw new BizException(ErrorCode.STATE_NOT_ALLOWED, '你还没有通过审核的报名记录，不能签到');
    }

    const existing = await this.prisma.client.activityCheckin.findFirst({
      where: { activityId, memberId: me.memberId },
      select: { id: true, checkinTime: true },
    });
    if (existing?.checkinTime !== null && existing?.checkinTime !== undefined) {
      throw new BizException(ErrorCode.ALREADY_CHECKED_IN);
    }

    const status = this.resolveStatus(now, activity);

    if (existing === null) {
      // 免审核报名会预先建占位记录；没有占位（例如报名后被拒又恢复）时补一条
      await this.prisma.client.activityCheckin.create({
        data: {
          clubId: me.clubId,
          activityId,
          registrationId: registration.id,
          memberId: me.memberId,
          checkinTime: now,
          checkinType: activity.checkinType,
          checkinIp: null,
          status,
        },
      });
    } else {
      await this.prisma.client.activityCheckin.update({
        where: { id: existing.id },
        data: { checkinTime: now, checkinType: activity.checkinType, status },
      });
    }

    return {
      checkinTime: now.toISOString(),
      status,
      statusLabel: CHECKIN_STATUS_LABEL[status as CheckinStatusValue] ?? String(status),
    };
  }

  /** 管理员代签：现场没带手机、设备没电等情况的兜底手段，必须填原因 */
  async makeup(
    me: MemberContext,
    activityId: bigint,
    memberId: bigint,
    reason: string,
  ): Promise<{ checkinTime: string }> {
    if (reason.trim() === '') {
      throw new BizException(ErrorCode.PARAM_INVALID, '代签必须填写原因');
    }
    const activity = await this.activityService.loadActivityForCheckin(me.clubId, activityId);
    await this.activityService.assertActiveMember(me.clubId, memberId);

    const registration = await this.prisma.client.activityRegistration.findFirst({
      where: { activityId, memberId },
      select: { id: true, status: true },
    });
    if (registration === null) {
      throw new BizException(ErrorCode.STATE_NOT_ALLOWED, '该成员没有报名这个活动');
    }
    if (registration.status !== RegistrationStatus.APPROVED) {
      throw new BizException(ErrorCode.STATE_NOT_ALLOWED, '该成员的报名尚未通过审核');
    }

    const now = new Date();
    const existing = await this.prisma.client.activityCheckin.findFirst({
      where: { activityId, memberId },
      select: { id: true },
    });

    if (existing === null) {
      await this.prisma.client.activityCheckin.create({
        data: {
          clubId: me.clubId,
          activityId,
          registrationId: registration.id,
          memberId,
          checkinTime: now,
          checkinType: CheckinType.ADMIN,
          status: this.resolveStatus(now, activity),
          isMakeup: true,
          makeupBy: me.memberId,
          makeupReason: reason,
        },
      });
    } else {
      await this.prisma.client.activityCheckin.update({
        where: { id: existing.id },
        data: {
          checkinTime: now,
          checkinType: CheckinType.ADMIN,
          status: this.resolveStatus(now, activity),
          isMakeup: true,
          makeupBy: me.memberId,
          makeupReason: reason,
        },
      });
    }

    return { checkinTime: now.toISOString() };
  }

  /** 标记缺勤：活动结束后由管理员一键把没签到的人标成缺勤 */
  async markAbsent(me: MemberContext, activityId: bigint): Promise<{ marked: number }> {
    await this.activityService.loadActivityForCheckin(me.clubId, activityId);
    const result = await this.prisma.client.activityCheckin.updateMany({
      where: { activityId, checkinTime: null, status: { not: CheckinStatus.ABSENT } },
      data: { status: CheckinStatus.ABSENT },
    });
    return { marked: result.count };
  }

  async page(
    me: MemberContext,
    query: RegistrationQuery & { activityId?: string },
  ): Promise<PageResult<CheckinVo>> {
    const { page, pageSize } = normalizePage(query);
    const activityId = query.activityId === undefined || query.activityId === '' ? null : parseId(query.activityId);

    const activityIds =
      activityId === null ? await this.visibleActivityIds(me) : [activityId];

    const filters: Record<string, unknown> = { activityId: { in: activityIds } };
    if (query.status !== undefined) filters.status = query.status;
    if (query.keyword !== undefined && query.keyword !== '') {
      filters.member = { user: { realName: { contains: query.keyword.trim() } } };
    }

    const [total, rows] = await Promise.all([
      this.prisma.client.activityCheckin.count({ where: filters }),
      this.prisma.client.activityCheckin.findMany({
        where: filters,
        orderBy: [{ checkinTime: 'desc' }, { id: 'asc' }],
        skip: skipOf(page, pageSize),
        take: pageSize,
        include: {
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

    return {
      list: rows.map((row) => ({
        id: row.id.toString(),
        activityId: row.activityId.toString(),
        memberId: row.memberId.toString(),
        memberName: row.member.user.realName,
        deptName: row.member.dept?.name ?? null,
        checkinTime: row.checkinTime?.toISOString() ?? null,
        checkinType: row.checkinType,
        checkinTypeLabel:
          CHECKIN_TYPE_LABEL[row.checkinType as CheckinTypeValue] ?? String(row.checkinType),
        status: row.status,
        statusLabel: CHECKIN_STATUS_LABEL[row.status as CheckinStatusValue] ?? String(row.status),
        isMakeup: row.isMakeup,
        makeupReason: row.makeupReason,
      })),
      total,
      page,
      pageSize,
    };
  }

  /** 签到列表是管理视角，按数据范围限制 */
  private async visibleActivityIds(me: MemberContext): Promise<bigint[]> {
    const managedWhere = await this.activityService.buildManagedWhere(me);
    const rows = await this.prisma.client.activity.findMany({
      where: managedWhere,
      select: { id: true },
    });
    return rows.map((row) => row.id);
  }

  /** 迟到 / 早退的判定：与活动起止时间比较，留 10 分钟宽限 */
  private resolveStatus(
    now: Date,
    activity: { startTime?: Date | null; endTime?: Date | null },
  ): number {
    const graceMs = 10 * 60 * 1000;
    if (activity.startTime !== null && activity.startTime !== undefined) {
      if (now.getTime() > activity.startTime.getTime() + graceMs) return CheckinStatus.LATE;
    }
    return CheckinStatus.NORMAL;
  }
}
