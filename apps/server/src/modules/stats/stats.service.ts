/**
 * 统计。阶段 1 先提供工作台要用的概览数字，阶段 5 再补图表。
 * 成员数按当前登录者的数据范围统计——这也是数据范围在界面上最直观的体现。
 */
import { Injectable } from '@nestjs/common';
import {
  ACTIVITY_STATUS_LABEL,
  ActivityStatus,
  ApprovalTaskStatus,
  DATA_SCOPE_LABEL,
  DataScope,
  MemberStatus,
  type DashboardVo,
  type OverviewVo,
  type PublicOverviewVo,
} from '@club/shared';
import { buildScopeWhere } from '../../common/prisma/data-scope.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import type { MemberContext } from '../../common/types/member-context.js';

@Injectable()
export class StatsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 登录页展示用。未登录可访问，所以只暴露规模数字，不暴露任何名单或明细。
   */
  async publicOverview(): Promise<PublicOverviewVo> {
    const club = await this.prisma.client.club.findFirst({
      orderBy: { id: 'asc' },
      select: { id: true, name: true, shortName: true, foundedAt: true },
    });
    if (club === null) {
      return { clubName: '星野天文社', shortName: null, foundedYear: null, memberCount: 0, deptCount: 0 };
    }

    const [memberCount, deptCount] = await Promise.all([
      this.prisma.client.member.count({
        where: { clubId: club.id, status: MemberStatus.ACTIVE },
      }),
      this.prisma.client.department.count({ where: { clubId: club.id, status: 1 } }),
    ]);

    return {
      clubName: club.name,
      shortName: club.shortName,
      foundedYear: club.foundedAt?.getFullYear() ?? null,
      memberCount,
      deptCount,
    };
  }

  /**
   * 数据看板。所有数字都是实时查询出来的，没有一个是写死的展示值。
   * 成员相关指标按当前登录者的数据范围统计，其余按社团口径。
   */
  async dashboard(me: MemberContext): Promise<DashboardVo> {
    const scopeWhere = await buildScopeWhere(this.prisma, me, 'member');
    const now = new Date();
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

    const [
      memberCount,
      clubMemberCount,
      deptCount,
      activityCount,
      ongoingCount,
      pendingApprovalCount,
      unreadCount,
      byDept,
      byActivityStatus,
      recentMembers,
      monthPoints,
    ] = await Promise.all([
      this.prisma.client.member.count({ where: scopeWhere }),
      this.prisma.client.member.count({ where: { clubId: me.clubId, status: MemberStatus.ACTIVE } }),
      this.prisma.client.department.count({ where: { clubId: me.clubId, status: 1 } }),
      this.prisma.client.activity.count({ where: { clubId: me.clubId } }),
      this.prisma.client.activity.count({
        where: {
          clubId: me.clubId,
          status: { in: [ActivityStatus.REGISTERING, ActivityStatus.ONGOING] },
        },
      }),
      this.prisma.client.approvalTask.count({
        where: { approverMemberId: me.memberId, status: ApprovalTaskStatus.PENDING },
      }),
      this.prisma.client.notificationReceiver.count({
        where: { receiverUserId: me.userId, isRead: false, isDeleted: false },
      }),
      // 部门构成：只取长度对比，不加背景槽
      this.prisma.client.department.findMany({
        where: { clubId: me.clubId, status: 1 },
        orderBy: { sort: 'asc' },
        select: { name: true, _count: { select: { members: true } } },
      }),
      this.prisma.client.activity.groupBy({
        by: ['status'],
        where: { clubId: me.clubId },
        _count: { _all: true },
      }),
      // 近半年入社人数，按月统计
      this.prisma.client.member.findMany({
        where: { clubId: me.clubId, joinDate: { gte: sixMonthsAgo } },
        select: { joinDate: true },
      }),
      this.prisma.client.pointRecord.aggregate({
        where: { clubId: me.clubId, occurredAt: { gte: sixMonthsAgo } },
        _sum: { points: true },
      }),
    ]);

    // 月度入社趋势
    const monthly = new Map<string, number>();
    for (let i = 5; i >= 0; i -= 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthly.set(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, 0);
    }
    for (const row of recentMembers) {
      if (row.joinDate === null) continue;
      const key = `${row.joinDate.getFullYear()}-${String(row.joinDate.getMonth() + 1).padStart(2, '0')}`;
      const current = monthly.get(key);
      if (current !== undefined) monthly.set(key, current + 1);
    }

    // 积分排行前 5
    const topMembers = await this.prisma.client.member.findMany({
      where: { clubId: me.clubId, status: MemberStatus.ACTIVE },
      orderBy: { totalPoints: 'desc' },
      take: 5,
      select: {
        id: true,
        totalPoints: true,
        user: { select: { realName: true } },
        dept: { select: { name: true } },
      },
    });

    return {
      memberCount,
      clubMemberCount,
      deptCount,
      activityCount,
      ongoingCount,
      pendingApprovalCount,
      unreadCount,
      monthPoints: monthPoints._sum.points ?? 0,
      deptDistribution: byDept.map((row) => ({
        name: row.name,
        count: row._count.members,
      })),
      activityStatusDistribution: byActivityStatus.map((row) => ({
        status: row.status,
        label: ACTIVITY_STATUS_LABEL[row.status as ActivityStatus] ?? String(row.status),
        count: row._count._all,
      })),
      memberGrowth: [...monthly.entries()].map(([month, count]) => ({ month, count })),
      topMembers: topMembers.map((row) => ({
        id: row.id.toString(),
        name: row.user.realName,
        deptName: row.dept?.name ?? null,
        points: row.totalPoints,
      })),
    };
  }

  async overview(me: MemberContext): Promise<OverviewVo> {
    const scopeWhere = await buildScopeWhere(this.prisma, me, 'member');

    const [memberCount, clubMemberCount, deptCount, roleCount] = await Promise.all([
      // 受数据范围限制
      this.prisma.client.member.count({ where: scopeWhere }),
      // 全社团在册人数，作为对比基准
      this.prisma.client.member.count({
        where: { clubId: me.clubId, status: MemberStatus.ACTIVE },
      }),
      this.prisma.client.department.count({ where: { clubId: me.clubId, status: 1 } }),
      this.prisma.client.role.count({ where: { clubId: me.clubId, status: 1 } }),
    ]);

    return {
      memberCount,
      clubMemberCount,
      deptCount,
      roleCount,
      permissionCount: me.permissions.size,
      maxDataScope: me.maxDataScope,
      maxDataScopeLabel: DATA_SCOPE_LABEL[me.maxDataScope as DataScope] ?? '未知',
      scopeDescription: describeScope(me),
    };
  }
}

function describeScope(me: MemberContext): string {
  switch (me.maxDataScope) {
    case DataScope.ALL:
    case DataScope.CLUB:
      return '你可以查看本社团全部成员的数据。';
    case DataScope.DEPT_AND_BELOW:
      return me.deptName !== null
        ? `你可以查看「${me.deptName}」及其下级部门的成员数据。`
        : '你没有归属部门，数据范围退化为仅本人。';
    case DataScope.DEPT:
      return me.deptName !== null
        ? `你可以查看「${me.deptName}」的成员数据。`
        : '你没有归属部门，数据范围退化为仅本人。';
    default:
      return '你只能查看自己的数据。';
  }
}
