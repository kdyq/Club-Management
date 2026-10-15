/**
 * 成员服务。
 *
 * 这是第一个真正落地的业务查询，用来验证两层权限都在起作用：
 * - 功能权限由 @RequirePerm + PermissionGuard 拦（能不能看）
 * - 数据范围由 buildScopeWhere 生成 where（能看谁的数据）
 */
import { Injectable } from '@nestjs/common';
import {
  MemberPosition,
  MemberStatus,
  MEMBER_POSITION_LABEL,
  MEMBER_STATUS_LABEL,
  normalizePage,
  skipOf,
  type MemberVo,
  type PageResult,
} from '@club/shared';
import { buildScopeWhere } from '../../common/prisma/data-scope.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import type { MemberContext } from '../../common/types/member-context.js';
import type { QueryMemberDto } from './dto/query-member.dto.js';

const SORTABLE_FIELDS = new Set(['joinDate', 'memberNo', 'totalPoints']);

@Injectable()
export class MemberService {
  constructor(private readonly prisma: PrismaService) {}

  async page(me: MemberContext, query: QueryMemberDto): Promise<PageResult<MemberVo>> {
    const { page, pageSize } = normalizePage(query);
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

    const where = { ...scopeWhere, ...filters };
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

    return { list: rows.map((row) => toMemberVo(row)), total, page, pageSize };
  }
}

interface MemberRow {
  id: bigint;
  memberNo: string | null;
  position: number;
  status: number;
  isCore: boolean;
  totalPoints: number;
  joinDate: Date | null;
  deptId: bigint | null;
  dept: { id: bigint; name: string } | null;
  user: {
    realName: string;
    studentNo: string | null;
    gender: number;
    grade: string | null;
    major: string | null;
    className: string | null;
    phone: string | null;
    email: string | null;
    avatarUrl: string | null;
  };
  roles: { role: { id: bigint; code: string; name: string } }[];
}

/** 对外不返回 passwordHash 等敏感字段（提交前自检清单第 3 条） */
export function toMemberVo(row: MemberRow): MemberVo {
  return {
    id: row.id.toString(),
    memberNo: row.memberNo,
    realName: row.user.realName,
    studentNo: row.user.studentNo,
    gender: row.user.gender,
    grade: row.user.grade,
    major: row.user.major,
    className: row.user.className,
    phone: row.user.phone,
    email: row.user.email,
    avatarUrl: row.user.avatarUrl,
    deptId: row.deptId?.toString() ?? null,
    deptName: row.dept?.name ?? null,
    position: row.position,
    positionLabel:
      MEMBER_POSITION_LABEL[row.position as MemberPosition] ?? String(row.position),
    status: row.status,
    statusLabel: MEMBER_STATUS_LABEL[row.status as MemberStatus] ?? String(row.status),
    isCore: row.isCore,
    totalPoints: row.totalPoints,
    joinDate: row.joinDate?.toISOString().slice(0, 10) ?? null,
    roles: row.roles.map(({ role }) => ({
      id: role.id.toString(),
      code: role.code,
      name: role.name,
    })),
  };
}
