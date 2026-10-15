/**
 * 成员列表查询。
 *
 * 这个模块是两层权限的样板：功能权限由 @RequirePerm + PermissionGuard 拦，
 * 数据范围由 buildScopeWhere 生成 where。导出接口同样要过数据范围——
 * Excel 导出是最容易被忽略的越权入口（开发文档 7.5 节）。
 */
import { Injectable } from '@nestjs/common';
import {
  normalizePage,
  skipOf,
  type MemberVo,
  type PageResult,
} from '@club/shared';
import { buildScopeWhere } from '../../common/prisma/data-scope.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import type { MemberContext } from '../../common/types/member-context.js';
import type { QueryMemberDto } from './dto/query-member.dto.js';
import { toMemberVo, type MemberRow } from './member.mapper.js';

const SORTABLE_FIELDS = new Set(['joinDate', 'memberNo', 'totalPoints']);

@Injectable()
export class MemberService {
  constructor(private readonly prisma: PrismaService) {}

  /** 把查询条件 + 数据范围拼成 where，列表与导出共用，保证两者口径一致 */
  async buildWhere(me: MemberContext, query: QueryMemberDto): Promise<Record<string, unknown>> {
    const scopeWhere = await buildScopeWhere(this.prisma, me, 'member');
    const filters: Record<string, unknown> = {};

    if (query.keyword !== undefined && query.keyword !== '') {
      const keyword = query.keyword.trim();
      filters.OR = [
        { memberNo: { contains: keyword } },
        { user: { realName: { contains: keyword } } },
        { user: { studentNo: { contains: keyword } } },
      ];
    }
    if (query.deptId !== undefined && query.deptId !== '') {
      filters.deptId = BigInt(query.deptId);
    }
    if (query.status !== undefined) filters.status = query.status;
    if (query.position !== undefined) filters.position = query.position;

    return { ...scopeWhere, ...filters };
  }

  async page(me: MemberContext, query: QueryMemberDto): Promise<PageResult<MemberVo>> {
    const { page, pageSize } = normalizePage(query);
    const where = await this.buildWhere(me, query);

    const sortBy = SORTABLE_FIELDS.has(query.sortBy ?? '') ? (query.sortBy as string) : 'memberNo';
    const sortOrder = query.sortOrder === 'desc' ? 'desc' : 'asc';

    const [total, rows] = await Promise.all([
      this.prisma.client.member.count({ where }),
      this.prisma.client.member.findMany({
        where,
        orderBy: [{ position: 'asc' }, { [sortBy]: sortOrder }],
        skip: skipOf(page, pageSize),
        take: pageSize,
        include: {
          user: true,
          dept: { select: { id: true, name: true } },
          roles: { include: { role: { select: { id: true, code: true, name: true } } } },
        },
      }),
    ]);

    return { list: rows.map((row) => toMemberVo(row as unknown as MemberRow)), total, page, pageSize };
  }

  /** 导出用：不分页，但仍然带数据范围与筛选条件 */
  async listForExport(
    me: MemberContext,
    query: QueryMemberDto,
    limit = 5000,
  ): Promise<MemberVo[]> {
    const where = await this.buildWhere(me, query);
    const rows = await this.prisma.client.member.findMany({
      where,
      orderBy: [{ position: 'asc' }, { memberNo: 'asc' }],
      take: limit,
      include: {
        user: true,
        dept: { select: { id: true, name: true } },
        roles: { include: { role: { select: { id: true, code: true, name: true } } } },
      },
    });
    return rows.map((row) => toMemberVo(row as unknown as MemberRow));
  }
}
