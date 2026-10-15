/**
 * 活动。阶段 3 的核心：从草稿到归档的整条链路。
 *
 * 状态流转（与 shared 的 ActivityStatus 对齐）：
 *   1 草稿 → 提交审批 → 2 待审批 → 通过 → 3 报名中 → 4 报名结束 → 5 进行中 → 6 已结束
 *   驳回时退回 1 草稿（可修改后重新提交），任意阶段可 7 取消。
 *
 * 归档后活动只读：届次归档同理，都是为了让历史档案不可被改写。
 */
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  ActivityStatus,
  ACTIVITY_STATUS_LABEL,
  BizType,
  CheckinStatus,
  CheckinType,
  ErrorCode,
  MemberStatus,
  PointType,
  RegistrationStatus,
  normalizePage,
  skipOf,
  type ActivityCategoryVo,
  type ActivityQuery,
  type ActivityVo,
  type CheckinTokenVo,
  type PageResult,
  type PointRecordVo,
} from '@club/shared';
import { BizException } from '../../common/exceptions/biz.exception.js';
import { buildScopeWhere } from '../../common/prisma/data-scope.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import type { MemberContext } from '../../common/types/member-context.js';
import { parseId } from '../../common/utils/parse-id.js';
import { ApprovalService } from '../approval/approval.service.js';
import type { ApprovableInstance } from '../approval/types/approvable-handler.js';
import { toActivityCategoryVo, toActivityVo, type ActivityRow } from './activity.mapper.js';
import {
  CreateActivityDto,
  CreateCategoryDto,
  QueryPointRecordDto,
  UpdateActivityDto,
  UpdateCategoryDto,
} from './dto/activity.dto.js';

/** 已归档、只读的状态 */
const READONLY_STATUSES = new Set<number>([ActivityStatus.FINISHED, ActivityStatus.CANCELLED]);

interface CategoryRow {
  id: bigint;
  name: string;
  color: string | null;
  sort: number;
  status: number;
  _count: { activities: number };
}

export interface LoadedActivity {
  id: bigint;
  title: string;
  status: number;
  location: string | null;
  startTime: Date;
  endTime: Date;
  checkinType: number;
  checkinStart: Date | null;
  checkinEnd: Date | null;
  qrSecret: string | null;
  qrRefreshSec: number;
  capacity: number;
  needAudit: boolean;
  points: number;
  volunteerHours: { toString(): string };
  budgetAmount: { toString(): string };
  termId: bigint | null;
  summaryReport: string | null;
}

@Injectable()
export class ActivityService {
  private readonly logger = new Logger(ActivityService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly approval: ApprovalService,
  ) {}

  // ---------------------------------------------------------------------------
  // 活动分类
  // ---------------------------------------------------------------------------

  async categories(me: MemberContext): Promise<ActivityCategoryVo[]> {
    const rows = await this.prisma.client.activityCategory.findMany({
      where: { clubId: me.clubId },
      orderBy: [{ sort: 'asc' }, { id: 'asc' }],
      include: { _count: { select: { activities: true } } },
    });
    return rows.map((row) => toActivityCategoryVo(row as CategoryRow));
  }

  async createCategory(me: MemberContext, dto: CreateCategoryDto): Promise<ActivityCategoryVo> {
    const exists = await this.prisma.client.activityCategory.findFirst({
      where: { clubId: me.clubId, name: dto.name },
      select: { id: true },
    });
    if (exists !== null) {
      throw new BizException(ErrorCode.DUPLICATE_RECORD, `分类「${dto.name}」已存在`);
    }

    const row = await this.prisma.client.activityCategory.create({
      data: {
        clubId: me.clubId,
        name: dto.name,
        color: dto.color ?? null,
        sort: dto.sort ?? 0,
        status: 1,
      },
      include: { _count: { select: { activities: true } } },
    });
    return toActivityCategoryVo(row as CategoryRow);
  }

  async updateCategory(
    me: MemberContext,
    id: bigint,
    dto: UpdateCategoryDto,
  ): Promise<ActivityCategoryVo> {
    const owned = await this.prisma.client.activityCategory.findFirst({
      where: { id, clubId: me.clubId },
      select: { id: true },
    });
    if (owned === null) throw new BizException(ErrorCode.NOT_FOUND, '活动分类不存在');

    const row = await this.prisma.client.activityCategory.update({
      where: { id },
      data: { name: dto.name, color: dto.color, sort: dto.sort, status: dto.status },
      include: { _count: { select: { activities: true } } },
    });
    return toActivityCategoryVo(row as CategoryRow);
  }

  // ---------------------------------------------------------------------------
  // 查询
  // ---------------------------------------------------------------------------

  /**
   * 活动列表/详情的可见范围：**本社团内公开**。
   *
   * 这里刻意不套用数据范围的「组织者部门」维度。活动是社团的公开事件——
   * 一个普通成员应该能看到本社团的所有活动，尤其是他自己报名过的那些。
   * 数据范围约束的是**管理动作**（改、删、审报名、代签），那是 buildManagedWhere 的事。
   * 一开始两者都用数据范围，导致报了名的成员看不到自己报的活动，这是错的。
   */
  async buildWhere(me: MemberContext, query: ActivityQuery): Promise<Record<string, unknown>> {
    const filters: Record<string, unknown> = {};

    if (query.keyword !== undefined && query.keyword !== '') {
      filters.title = { contains: query.keyword.trim() };
    }
    if (query.categoryId !== undefined && query.categoryId !== '') {
      filters.categoryId = parseId(query.categoryId);
    }
    if (query.status !== undefined) filters.status = query.status;
    if (query.mine === true) filters.organizerMemberId = me.memberId;
    if (query.joined === true) {
      filters.registrations = {
        some: { memberId: me.memberId, status: RegistrationStatus.APPROVED },
      };
    }

    return { clubId: me.clubId, ...filters };
  }

  /**
   * 管理动作的可见范围：按数据范围过滤（部长只能管本部门及以下组织的活动，
   * 干事只能管本部门，普通成员只能管自己组织的）。
   */
  async buildManagedWhere(me: MemberContext): Promise<Record<string, unknown>> {
    return buildScopeWhere(this.prisma, me, 'activity');
  }

  async page(me: MemberContext, query: ActivityQuery): Promise<PageResult<ActivityVo>> {
    const { page, pageSize } = normalizePage(query);
    const where = await this.buildWhere(me, query);

    const [total, rows] = await Promise.all([
      this.prisma.client.activity.count({ where }),
      this.prisma.client.activity.findMany({
        where,
        orderBy: { startTime: 'desc' },
        skip: skipOf(page, pageSize),
        take: pageSize,
        include: this.detailInclude(),
      }),
    ]);

    return { list: await this.attachCounts(rows as ActivityRow[]), total, page, pageSize };
  }

  async detail(me: MemberContext, id: bigint): Promise<ActivityVo> {
    const row = await this.loadRow(me, id);
    const [vo] = await this.attachCounts([row]);
    return vo as ActivityVo;
  }

  // ---------------------------------------------------------------------------
  // 写操作
  // ---------------------------------------------------------------------------

  async create(me: MemberContext, dto: CreateActivityDto): Promise<ActivityVo> {
    this.assertTimeRange(dto.startTime, dto.endTime);
    const categoryId = await this.resolveCategoryId(me, dto.categoryId ?? null);
    const termId = await this.currentTermId(me.clubId);

    const row = await this.prisma.client.activity.create({
      data: {
        clubId: me.clubId,
        categoryId,
        termId,
        title: dto.title,
        summary: dto.summary ?? null,
        content: dto.content ?? null,
        location: dto.location ?? null,
        startTime: new Date(dto.startTime),
        endTime: new Date(dto.endTime),
        signupStart: dto.signupStart === undefined ? null : new Date(dto.signupStart),
        signupEnd: dto.signupEnd === undefined ? null : new Date(dto.signupEnd),
        capacity: dto.capacity ?? 0,
        minMembers: dto.minMembers ?? 0,
        needAudit: dto.needAudit ?? false,
        organizerMemberId: me.memberId,
        contactInfo: dto.contactInfo ?? null,
        checkinType: dto.checkinType ?? CheckinType.QRCODE,
        checkinStart: dto.checkinStart === undefined ? null : new Date(dto.checkinStart),
        checkinEnd: dto.checkinEnd === undefined ? null : new Date(dto.checkinEnd),
        points: dto.points ?? 0,
        volunteerHours: (dto.volunteerHours ?? 0).toFixed(1),
        budgetAmount: (dto.budgetAmount ?? 0).toFixed(2),
        status: ActivityStatus.DRAFT,
        createdBy: me.userId,
      },
      include: this.detailInclude(),
    });

    const [vo] = await this.attachCounts([row as ActivityRow]);
    return vo as ActivityVo;
  }

  async update(me: MemberContext, id: bigint, dto: UpdateActivityDto): Promise<ActivityVo> {
    const current = await this.loadOwned(me, id);

    if (READONLY_STATUSES.has(current.status)) {
      throw new BizException(ErrorCode.STATE_NOT_ALLOWED, '已结束或已取消的活动不能再修改');
    }
    if (current.status !== ActivityStatus.DRAFT && current.status !== ActivityStatus.REGISTERING) {
      throw new BizException(
        ErrorCode.STATE_NOT_ALLOWED,
        `当前状态为「${ACTIVITY_STATUS_LABEL[current.status as ActivityStatus] ?? current.status}」，不允许修改`,
      );
    }
    if (dto.startTime !== undefined || dto.endTime !== undefined) {
      this.assertTimeRange(
        dto.startTime ?? current.startTime.toISOString(),
        dto.endTime ?? current.endTime.toISOString(),
      );
    }

    const categoryId =
      dto.categoryId === undefined ? undefined : await this.resolveCategoryId(me, dto.categoryId);

    const row = await this.prisma.client.activity.update({
      where: { id },
      data: {
        title: dto.title,
        categoryId,
        summary: dto.summary,
        content: dto.content,
        location: dto.location,
        startTime: dto.startTime === undefined ? undefined : new Date(dto.startTime),
        endTime: dto.endTime === undefined ? undefined : new Date(dto.endTime),
        signupStart: dto.signupStart === undefined ? undefined : new Date(dto.signupStart),
        signupEnd: dto.signupEnd === undefined ? undefined : new Date(dto.signupEnd),
        capacity: dto.capacity,
        minMembers: dto.minMembers,
        needAudit: dto.needAudit,
        contactInfo: dto.contactInfo,
        checkinType: dto.checkinType,
        checkinStart: dto.checkinStart === undefined ? undefined : new Date(dto.checkinStart),
        checkinEnd: dto.checkinEnd === undefined ? undefined : new Date(dto.checkinEnd),
        points: dto.points,
        volunteerHours: dto.volunteerHours === undefined ? undefined : dto.volunteerHours.toFixed(1),
        budgetAmount: dto.budgetAmount === undefined ? undefined : dto.budgetAmount.toFixed(2),
        summaryReport: dto.summaryReport,
        updatedBy: me.userId,
      },
      include: this.detailInclude(),
    });

    const [vo] = await this.attachCounts([row as ActivityRow]);
    return vo as ActivityVo;
  }

  async remove(me: MemberContext, id: bigint): Promise<void> {
    const current = await this.loadOwned(me, id);
    if (current.status !== ActivityStatus.DRAFT && current.status !== ActivityStatus.CANCELLED) {
      throw new BizException(ErrorCode.STATE_NOT_ALLOWED, '只有草稿或已取消的活动可以删除');
    }

    const registered = await this.prisma.client.activityRegistration.count({
      where: { activityId: id },
    });
    if (registered > 0) {
      throw new BizException(
        ErrorCode.BUSINESS_RULE_VIOLATED,
        `该活动已有 ${registered} 条报名记录，请改为取消活动而不是删除`,
      );
    }
    await this.prisma.client.activity.delete({ where: { id } });
  }

  /** 提交立项审批。通过后由审批引擎回调推进状态（开发文档 7.6 节），业务侧不轮询。 */
  async submitApproval(me: MemberContext, id: bigint): Promise<{ approvalInstanceId: string }> {
    const current = await this.loadOwned(me, id);
    if (current.status !== ActivityStatus.DRAFT) {
      throw new BizException(ErrorCode.STATE_NOT_ALLOWED, '只有草稿状态的活动可以提交审批');
    }

    const instance = await this.approval.submit({
      clubId: me.clubId,
      bizType: BizType.ACTIVITY,
      bizId: id,
      title: `活动立项：${current.title}`,
      applicantMemberId: me.memberId,
      formData: {
        location: current.location,
        startTime: current.startTime.toISOString(),
        budgetAmount: current.budgetAmount.toString(),
      },
    });

    await this.prisma.client.activity.update({
      where: { id },
      data: {
        status: ActivityStatus.PENDING_APPROVAL,
        approvalInstanceId: instance.id,
        updatedBy: me.userId,
      },
    });

    return { approvalInstanceId: instance.id.toString() };
  }

  async cancel(me: MemberContext, id: bigint, reason?: string): Promise<ActivityVo> {
    const current = await this.loadOwned(me, id);
    if (current.status === ActivityStatus.FINISHED) {
      throw new BizException(ErrorCode.STATE_NOT_ALLOWED, '已归档的活动不能取消');
    }

    const row = await this.prisma.client.activity.update({
      where: { id },
      data: {
        status: ActivityStatus.CANCELLED,
        summaryReport: reason === undefined ? undefined : `【取消原因】${reason}`,
        updatedBy: me.userId,
      },
      include: this.detailInclude(),
    });
    const [vo] = await this.attachCounts([row as ActivityRow]);
    return vo as ActivityVo;
  }

  /** 归档：写总结并结束活动，是整条链路的最后一步。归档后活动只读。 */
  async archive(me: MemberContext, id: bigint, summaryReport?: string): Promise<ActivityVo> {
    const current = await this.loadOwned(me, id);
    if (current.status === ActivityStatus.CANCELLED) {
      throw new BizException(ErrorCode.STATE_NOT_ALLOWED, '已取消的活动不需要归档');
    }
    if (current.status === ActivityStatus.FINISHED) {
      throw new BizException(ErrorCode.STATE_NOT_ALLOWED, '该活动已经归档过了');
    }

    const report = summaryReport ?? current.summaryReport;
    if (report === null || report.trim() === '') {
      throw new BizException(ErrorCode.PARAM_INVALID, '归档前请先填写活动总结');
    }

    const row = await this.prisma.client.activity.update({
      where: { id },
      data: { status: ActivityStatus.FINISHED, summaryReport: report, updatedBy: me.userId },
      include: this.detailInclude(),
    });
    const [vo] = await this.attachCounts([row as ActivityRow]);
    return vo as ActivityVo;
  }

  // ---------------------------------------------------------------------------
  // 签到口令：由服务端时间片计算，客户端只负责展示
  // ---------------------------------------------------------------------------

  async checkinToken(me: MemberContext, activityId: bigint): Promise<CheckinTokenVo> {
    const activity = await this.loadOwned(me, activityId);

    let secret = activity.qrSecret;
    if (secret === null) {
      secret = randomBytes(16).toString('hex');
      await this.prisma.client.activity.update({
        where: { id: activityId },
        data: { qrSecret: secret },
      });
    }

    const ttl = activity.qrRefreshSec > 0 ? activity.qrRefreshSec : 30;
    const token = tokenOf(activityId, secret, ttl, 0);
    const expiresIn = ttl - (Math.floor(Date.now() / 1000) % ttl);

    return {
      token,
      expiresIn,
      // 数字口令取 token 里的数字，方便人工播报
      code: toDigits(token),
      checkinType: activity.checkinType,
    };
  }

  /**
   * 校验签到口令，允许当前与上一个时间片。
   * 这样手机时钟有偏差、或者刚好跨过时间片边界时，签到不会莫名其妙失败。
   */
  verifyCheckinToken(
    activityId: bigint,
    secret: string,
    refreshSec: number,
    input: string,
  ): boolean {
    const ttl = refreshSec > 0 ? refreshSec : 30;
    for (const offset of [0, -1]) {
      const expected = tokenOf(activityId, secret, ttl, offset);
      if (safeEqual(input, expected) || safeEqual(input, toDigits(expected))) return true;
    }
    return false;
  }

  // ---------------------------------------------------------------------------
  // 积分
  // ---------------------------------------------------------------------------

  /**
   * 发放积分。**幂等**：同一活动对同一成员只发一次（按 bizType + bizId + memberId 去重），
   * 重复点不会重复加分——这是文档对任务幂等性的要求，手工发放同样适用。
   */
  async issuePoints(
    me: MemberContext,
    activityId: bigint,
    options: { points?: number; onlyCheckedIn?: boolean; reason?: string },
  ): Promise<{ issued: number; skipped: number }> {
    const activity = await this.loadOwned(me, activityId);
    const points = options.points ?? activity.points;
    if (points <= 0) {
      throw new BizException(ErrorCode.PARAM_INVALID, '活动未配置积分，请指定本次发放的分值');
    }

    const registrations = await this.prisma.client.activityRegistration.findMany({
      where: { activityId, status: RegistrationStatus.APPROVED, memberId: { not: null } },
      select: { memberId: true },
    });
    const candidateIds = registrations
      .map((row) => row.memberId)
      .filter((id): id is bigint => id !== null);

    let targetIds = candidateIds;
    if (options.onlyCheckedIn ?? true) {
      const checkins = await this.prisma.client.activityCheckin.findMany({
        where: {
          activityId,
          status: { in: [CheckinStatus.NORMAL, CheckinStatus.LATE, CheckinStatus.EARLY_LEAVE] },
        },
        select: { memberId: true },
      });
      const checkedIn = new Set(checkins.map((row) => row.memberId.toString()));
      targetIds = candidateIds.filter((id) => checkedIn.has(id.toString()));
    }

    if (targetIds.length === 0) return { issued: 0, skipped: 0 };

    const existing = await this.prisma.client.pointRecord.findMany({
      where: {
        clubId: me.clubId,
        memberId: { in: targetIds },
        bizType: BizType.ACTIVITY,
        bizId: activityId,
      },
      select: { memberId: true },
    });
    const alreadyIssued = new Set(existing.map((row) => row.memberId.toString()));
    const toIssue = targetIds.filter((id) => !alreadyIssued.has(id.toString()));

    if (toIssue.length === 0) {
      return { issued: 0, skipped: targetIds.length };
    }

    await this.prisma.transaction(async (tx) => {
      await tx.pointRecord.createMany({
        data: toIssue.map((memberId) => ({
          clubId: me.clubId,
          memberId,
          termId: activity.termId,
          points,
          reason: options.reason ?? `参与活动「${activity.title}」`,
          bizType: BizType.ACTIVITY,
          bizId: activityId,
          occurredAt: new Date(),
          operatorId: me.memberId,
          status: PointType.EARN,
        })),
      });

      // totalPoints 只是缓存字段，以流水为准重算，随时可以再算一次
      for (const memberId of toIssue) {
        const sum = await tx.pointRecord.aggregate({
          where: { memberId, clubId: me.clubId },
          _sum: { points: true },
        });
        await tx.member.update({
          where: { id: memberId },
          data: { totalPoints: sum._sum.points ?? 0 },
        });
      }
    });

    this.logger.log(`活动 ${activityId.toString()} 发放积分：${toIssue.length} 人 × ${points} 分`);
    return { issued: toIssue.length, skipped: targetIds.length - toIssue.length };
  }

  async pointRecords(
    me: MemberContext,
    query: QueryPointRecordDto,
  ): Promise<PageResult<PointRecordVo>> {
    const { page, pageSize } = normalizePage(query);
    const filters: Record<string, unknown> = { clubId: me.clubId };
    if (query.memberId !== undefined && query.memberId !== '') {
      filters.memberId = parseId(query.memberId);
    }
    if (query.activityId !== undefined && query.activityId !== '') {
      filters.bizType = BizType.ACTIVITY;
      filters.bizId = parseId(query.activityId);
    }

    const [total, rows] = await Promise.all([
      this.prisma.client.pointRecord.count({ where: filters }),
      this.prisma.client.pointRecord.findMany({
        where: filters,
        orderBy: { occurredAt: 'desc' },
        skip: skipOf(page, pageSize),
        take: pageSize,
        include: { member: { select: { user: { select: { realName: true } } } } },
      }),
    ]);

    return {
      list: rows.map((row) => ({
        id: row.id.toString(),
        memberId: row.memberId.toString(),
        memberName: row.member.user.realName,
        points: row.points,
        reason: row.reason,
        bizType: row.bizType,
        bizId: row.bizId?.toString() ?? null,
        occurredAt: row.occurredAt.toISOString(),
      })),
      total,
      page,
      pageSize,
    };
  }

  // ---------------------------------------------------------------------------
  // 审批回调（由 ApprovalService 调用）
  // ---------------------------------------------------------------------------

  async onApproved(instance: ApprovableInstance): Promise<void> {
    const activity = await this.prisma.client.activity.findFirst({
      where: { id: instance.bizId },
      select: { id: true, signupEnd: true },
    });
    if (activity === null) return;

    const signupClosed = activity.signupEnd !== null && activity.signupEnd < new Date();
    await this.prisma.client.activity.update({
      where: { id: instance.bizId },
      data: {
        status: signupClosed ? ActivityStatus.REGISTRATION_CLOSED : ActivityStatus.REGISTERING,
      },
    });
  }

  /** 驳回后退回草稿，让组织者改完重新提交 */
  async onRejected(instance: ApprovableInstance): Promise<void> {
    await this.prisma.client.activity.update({
      where: { id: instance.bizId },
      data: { status: ActivityStatus.DRAFT },
    });
  }

  // ---------------------------------------------------------------------------
  // 给报名 / 签到 / 请假服务复用的方法
  // ---------------------------------------------------------------------------

  async loadActivityForCheckin(clubId: bigint, activityId: bigint): Promise<LoadedActivity> {
    const row = await this.prisma.client.activity.findFirst({
      where: { id: activityId, clubId },
      select: {
        id: true,
        title: true,
        status: true,
        location: true,
        startTime: true,
        endTime: true,
        checkinType: true,
        checkinStart: true,
        checkinEnd: true,
        qrSecret: true,
        qrRefreshSec: true,
        capacity: true,
        needAudit: true,
        points: true,
        volunteerHours: true,
        budgetAmount: true,
        termId: true,
        summaryReport: true,
      },
    });
    if (row === null) throw new BizException(ErrorCode.NOT_FOUND, '活动不存在');
    return row as LoadedActivity;
  }

  /** 报名与签到的前提：必须是本社团在册成员 */
  async assertActiveMember(clubId: bigint, memberId: bigint): Promise<void> {
    const member = await this.prisma.client.member.findFirst({
      where: { id: memberId, clubId },
      select: { status: true },
    });
    if (member === null) throw new BizException(ErrorCode.MEMBER_NOT_FOUND);
    if (member.status !== MemberStatus.ACTIVE) {
      throw new BizException(
        ErrorCode.BUSINESS_RULE_VIOLATED,
        '只有状态为「在册」的成员可以参加活动',
      );
    }
  }

  // ---------------------------------------------------------------------------
  // 内部
  // ---------------------------------------------------------------------------

  /** 列表与详情共用的关联查询。返回具体类型而不是 Record，Prisma 才能推导出正确的行类型 */
  private detailInclude(): Prisma.ActivityInclude {
    return {
      category: { select: { id: true, name: true } },
      organizer: { select: { id: true, user: { select: { realName: true } } } },
    };
  }

  /** 详情：本社团成员都能看 */
  private async loadRow(me: MemberContext, id: bigint): Promise<ActivityRow> {
    const row = await this.prisma.client.activity.findFirst({
      where: { id, clubId: me.clubId },
      include: this.detailInclude(),
    });
    if (row === null) throw new BizException(ErrorCode.NOT_FOUND, '活动不存在');
    return row as ActivityRow;
  }

  /** 写操作：必须落在自己的数据范围内 */
  private async loadOwned(me: MemberContext, id: bigint): Promise<LoadedActivity> {
    const where = { ...(await this.buildManagedWhere(me)), id };
    const row = await this.prisma.client.activity.findFirst({
      where,
      select: {
        id: true,
        title: true,
        status: true,
        location: true,
        startTime: true,
        endTime: true,
        checkinType: true,
        checkinStart: true,
        checkinEnd: true,
        qrSecret: true,
        qrRefreshSec: true,
        capacity: true,
        needAudit: true,
        points: true,
        volunteerHours: true,
        budgetAmount: true,
        termId: true,
        summaryReport: true,
      },
    });
    if (row === null) {
      const exists = await this.prisma.client.activity.findFirst({
        where: { id },
        select: { id: true },
      });
      if (exists === null) throw new BizException(ErrorCode.NOT_FOUND, '活动不存在');
      throw new BizException(ErrorCode.OUT_OF_DATA_SCOPE);
    }
    return row as LoadedActivity;
  }

  /** 批量补报名与签到计数，避免列表页 N+1 查询 */
  private async attachCounts(rows: ActivityRow[]): Promise<ActivityVo[]> {
    if (rows.length === 0) return [];
    const ids = rows.map((row) => row.id);

    const [approved, pending, checked] = await Promise.all([
      this.prisma.client.activityRegistration.groupBy({
        by: ['activityId'],
        where: { activityId: { in: ids }, status: RegistrationStatus.APPROVED },
        _count: { _all: true },
      }),
      this.prisma.client.activityRegistration.groupBy({
        by: ['activityId'],
        where: { activityId: { in: ids }, status: RegistrationStatus.PENDING },
        _count: { _all: true },
      }),
      this.prisma.client.activityCheckin.groupBy({
        by: ['activityId'],
        where: { activityId: { in: ids }, status: { not: CheckinStatus.ABSENT } },
        _count: { _all: true },
      }),
    ]);

    const toMap = (list: { activityId: bigint; _count: { _all: number } }[]): Map<string, number> =>
      new Map(list.map((item) => [item.activityId.toString(), item._count._all]));

    const approvedMap = toMap(approved);
    const pendingMap = toMap(pending);
    const checkedMap = toMap(checked);

    return rows.map((row) => {
      const key = row.id.toString();
      return toActivityVo(row, {
        approvedCount: approvedMap.get(key) ?? 0,
        pendingCount: pendingMap.get(key) ?? 0,
        checkedInCount: checkedMap.get(key) ?? 0,
      });
    });
  }

  private assertTimeRange(start: string, end: string): void {
    if (new Date(end) <= new Date(start)) {
      throw new BizException(ErrorCode.PARAM_INVALID, '结束时间必须晚于开始时间');
    }
  }

  private async resolveCategoryId(me: MemberContext, raw: string | null): Promise<bigint | null> {
    if (raw === null || raw === undefined || raw === '') return null;
    const id = parseId(raw);
    const row = await this.prisma.client.activityCategory.findFirst({
      where: { id, clubId: me.clubId },
      select: { id: true },
    });
    if (row === null) throw new BizException(ErrorCode.NOT_FOUND, '活动分类不存在');
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

/** token = HMAC(qrSecret, 活动:时间片)，取前 16 位 */
function tokenOf(activityId: bigint, secret: string, ttl: number, offsetSlots: number): string {
  const slice = Math.floor(Date.now() / 1000 / ttl) + offsetSlots;
  return createHmac('sha256', secret)
    .update(`${activityId.toString()}:${slice}`)
    .digest('hex')
    .slice(0, 16);
}

/** 从 token 里取出 6 位数字，作为人工播报的口令 */
function toDigits(token: string): string {
  const digits = token.replace(/\D/g, '');
  return digits.padEnd(6, '0').slice(0, 6);
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
