/**
 * 统计。阶段 1 先提供工作台要用的概览数字，阶段 5 再补图表。
 * 成员数按当前登录者的数据范围统计——这也是数据范围在界面上最直观的体现。
 */
import { Injectable } from '@nestjs/common';
import {
  DATA_SCOPE_LABEL,
  DataScope,
  MemberStatus,
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
