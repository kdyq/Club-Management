/** 活动请假。一人一活动一条记录，重复提交由唯一索引拦住。 */
import { Injectable } from '@nestjs/common';
import {
  ErrorCode,
  LeaveStatus,
  LEAVE_STATUS_LABEL,
  normalizePage,
  skipOf,
  RegistrationStatus,
  type LeaveVo,
  type PageResult,
  type RegistrationQuery,
} from '@club/shared';
import { BizException } from '../../common/exceptions/biz.exception.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import type { MemberContext } from '../../common/types/member-context.js';
import { parseId } from '../../common/utils/parse-id.js';
import { ActivityService } from './activity.service.js';
import type { AuditLeaveDto } from './dto/activity.dto.js';

@Injectable()
export class LeaveService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityService: ActivityService,
  ) {}

  async apply(me: MemberContext, activityId: bigint, reason: string): Promise<LeaveVo> {
    if (reason.trim() === '') {
      throw new BizException(ErrorCode.PARAM_INVALID, '请填写请假原因');
    }
    await this.activityService.loadActivityForCheckin(me.clubId, activityId);

    const registration = await this.prisma.client.activityRegistration.findFirst({
      where: { activityId, memberId: me.memberId },
      select: { status: true },
    });
    if (registration === null || registration.status !== RegistrationStatus.APPROVED) {
      throw new BizException(ErrorCode.STATE_NOT_ALLOWED, '只有已通过报名的成员可以请假');
    }

    const existing = await this.prisma.client.activityLeave.findFirst({
      where: { activityId, memberId: me.memberId },
      select: { id: true, status: true },
    });
    if (existing !== null) {
      throw new BizException(
        ErrorCode.DUPLICATE_RECORD,
        existing.status === LeaveStatus.PENDING ? '你已经提交过请假申请了' : '你已经提交过请假申请，请勿重复提交',
      );
    }

    const row = await this.prisma.client.activityLeave.create({
      data: {
        clubId: me.clubId,
        activityId,
        memberId: me.memberId,
        reason,
        status: LeaveStatus.PENDING,
      },
      include: {
        activity: { select: { title: true } },
        member: { select: { user: { select: { realName: true } } } },
      },
    });
    return toLeaveVo(row as never);
  }

  async audit(me: MemberContext, leaveId: bigint, dto: AuditLeaveDto): Promise<LeaveVo> {
    const row = await this.prisma.client.activityLeave.findFirst({
      where: { id: leaveId, clubId: me.clubId },
      select: { id: true, status: true },
    });
    if (row === null) throw new BizException(ErrorCode.NOT_FOUND, '请假记录不存在');
    if (row.status !== LeaveStatus.PENDING) {
      throw new BizException(ErrorCode.STATE_NOT_ALLOWED, '该请假已经处理过了');
    }
    if (!dto.approved && (dto.remark === undefined || dto.remark.trim() === '')) {
      throw new BizException(ErrorCode.PARAM_INVALID, '驳回请假时需要填写原因');
    }

    const updated = await this.prisma.client.activityLeave.update({
      where: { id: leaveId },
      data: {
        status: dto.approved ? LeaveStatus.APPROVED : LeaveStatus.REJECTED,
        auditBy: me.memberId,
        auditAt: new Date(),
        auditRemark: dto.remark ?? null,
      },
      include: {
        activity: { select: { title: true } },
        member: { select: { user: { select: { realName: true } } } },
      },
    });
    return toLeaveVo(updated as never);
  }

  async page(me: MemberContext, query: RegistrationQuery): Promise<PageResult<LeaveVo>> {
    const { page, pageSize } = normalizePage(query);
    const managedWhere = await this.activityService.buildManagedWhere(me);
    const activities = await this.prisma.client.activity.findMany({
      where: managedWhere,
      select: { id: true },
    });

    const filters: Record<string, unknown> = { activityId: { in: activities.map((row) => row.id) } };
    if (query.activityId !== undefined && query.activityId !== '') {
      filters.activityId = parseId(query.activityId);
    }
    if (query.status !== undefined) filters.status = query.status;

    const [total, rows] = await Promise.all([
      this.prisma.client.activityLeave.count({ where: filters }),
      this.prisma.client.activityLeave.findMany({
        where: filters,
        orderBy: [{ status: 'asc' }, { id: 'desc' }],
        skip: skipOf(page, pageSize),
        take: pageSize,
        include: {
          activity: { select: { title: true } },
          member: { select: { user: { select: { realName: true } } } },
        },
      }),
    ]);

    return { list: rows.map((row) => toLeaveVo(row as never)), total, page, pageSize };
  }
}

function toLeaveVo(row: {
  id: bigint;
  activityId: bigint;
  memberId: bigint;
  reason: string;
  status: number;
  auditRemark: string | null;
  createdAt: Date;
  activity: { title: string };
  member: { user: { realName: string } };
}): LeaveVo {
  return {
    id: row.id.toString(),
    activityId: row.activityId.toString(),
    activityTitle: row.activity.title,
    memberId: row.memberId.toString(),
    memberName: row.member.user.realName,
    reason: row.reason,
    status: row.status,
    statusLabel: LEAVE_STATUS_LABEL[row.status as LeaveStatus] ?? String(row.status),
    auditRemark: row.auditRemark,
    createdAt: row.createdAt.toISOString(),
  };
}
