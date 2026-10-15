/**
 * 部门树。
 *
 * parentId 可空，NULL 表示顶级（开发文档 6.1 节第 3 条：树形结构的 parentId
 * 一律可空，因为 schema 为自引用建了真实外键，0 会被 MySQL 以 1452 拒绝）。
 */
import { Injectable } from '@nestjs/common';
import { EnableStatus, ErrorCode, type DepartmentNodeVo } from '@club/shared';
import { BizException } from '../../common/exceptions/biz.exception.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import type { MemberContext } from '../../common/types/member-context.js';
import { parseId } from '../../common/utils/parse-id.js';
import {
  CreateDepartmentDto,
  UpdateDepartmentDto,
} from './dto/department.dto.js';

interface DepartmentRow {
  id: bigint;
  parentId: bigint | null;
  name: string;
  description: string | null;
  sort: number;
  status: number;
  leaderMemberId: bigint | null;
  leader: { id: bigint; user: { realName: string } } | null;
  _count: { members: number };
}

@Injectable()
export class DepartmentService {
  constructor(private readonly prisma: PrismaService) {}

  /** 一次性查全量再在内存里拼树：社团级部门量级下比递归查询更简单也更快 */
  async tree(me: MemberContext, includeDisabled = false): Promise<DepartmentNodeVo[]> {
    const rows = await this.prisma.client.department.findMany({
      where: {
        clubId: me.clubId,
        ...(includeDisabled ? {} : { status: EnableStatus.ENABLED }),
      },
      orderBy: [{ sort: 'asc' }, { id: 'asc' }],
      include: {
        leader: { select: { id: true, user: { select: { realName: true } } } },
        _count: { select: { members: true } },
      },
    });

    return buildTree(rows as DepartmentRow[]);
  }

  /** 扁平选项，给下拉与筛选用 */
  async options(me: MemberContext): Promise<{ id: string; name: string; parentId: string | null }[]> {
    const rows = await this.prisma.client.department.findMany({
      where: { clubId: me.clubId, status: EnableStatus.ENABLED },
      orderBy: [{ sort: 'asc' }, { id: 'asc' }],
      select: { id: true, name: true, parentId: true },
    });
    return rows.map((row) => ({
      id: row.id.toString(),
      name: row.name,
      parentId: row.parentId?.toString() ?? null,
    }));
  }

  async create(me: MemberContext, dto: CreateDepartmentDto): Promise<DepartmentNodeVo> {
    const parentId = await this.resolveParentId(me, dto.parentId ?? null);

    const duplicate = await this.prisma.client.department.findFirst({
      where: { clubId: me.clubId, parentId, name: dto.name },
      select: { id: true },
    });
    if (duplicate !== null) {
      throw new BizException(ErrorCode.DUPLICATE_RECORD, `同级下已存在名为「${dto.name}」的部门`);
    }

    const row = await this.prisma.client.department.create({
      data: {
        clubId: me.clubId,
        parentId,
        name: dto.name,
        leaderMemberId: dto.leaderMemberId !== undefined && dto.leaderMemberId !== null
          ? await this.resolveMemberId(me, dto.leaderMemberId)
          : null,
        description: dto.description ?? null,
        sort: dto.sort ?? 0,
        status: EnableStatus.ENABLED,
        createdBy: me.userId,
      },
      include: {
        leader: { select: { id: true, user: { select: { realName: true } } } },
        _count: { select: { members: true } },
      },
    });
    return toNode(row as DepartmentRow);
  }

  async update(me: MemberContext, id: bigint, dto: UpdateDepartmentDto): Promise<DepartmentNodeVo> {
    await this.findOwned(me, id);

    let parentId: bigint | null | undefined;
    if (dto.parentId !== undefined) {
      parentId = await this.resolveParentId(me, dto.parentId);
      if (parentId === id) {
        throw new BizException(ErrorCode.BUSINESS_RULE_VIOLATED, '部门不能作为自己的上级');
      }
      if (parentId !== null) {
        const descendants = await this.subtreeIds(me, id);
        if (descendants.includes(parentId)) {
          throw new BizException(
            ErrorCode.BUSINESS_RULE_VIOLATED,
            '不能把部门挂到自己的下级部门下，那会让树成环',
          );
        }
      }
    }

    const row = await this.prisma.client.department.update({
      where: { id },
      data: {
        name: dto.name,
        parentId,
        leaderMemberId:
          dto.leaderMemberId === undefined
            ? undefined
            : dto.leaderMemberId === null
              ? null
              : await this.resolveMemberId(me, dto.leaderMemberId),
        description: dto.description,
        sort: dto.sort,
        status: dto.status,
        updatedBy: me.userId,
      },
      include: {
        leader: { select: { id: true, user: { select: { realName: true } } } },
        _count: { select: { members: true } },
      },
    });
    return toNode(row as DepartmentRow);
  }

  async remove(me: MemberContext, id: bigint): Promise<void> {
    await this.findOwned(me, id);

    const childCount = await this.prisma.client.department.count({
      where: { parentId: id, status: EnableStatus.ENABLED },
    });
    if (childCount > 0) {
      throw new BizException(
        ErrorCode.BUSINESS_RULE_VIOLATED,
        `该部门下还有 ${childCount} 个子部门，请先处理子部门`,
      );
    }

    const memberCount = await this.prisma.client.member.count({ where: { deptId: id } });
    if (memberCount > 0) {
      throw new BizException(
        ErrorCode.BUSINESS_RULE_VIOLATED,
        `该部门下还有 ${memberCount} 名成员，请先调整他们的部门`,
      );
    }

    // 断开负责人引用，否则 member 侧的外键会挡住后续操作
    await this.prisma.client.department.update({ where: { id }, data: { leaderMemberId: null } });
    await this.prisma.client.department.delete({ where: { id } });
  }

  /** 求某部门的子孙 id（含自身） */
  async subtreeIds(me: MemberContext, rootId: bigint): Promise<bigint[]> {
    const rows = await this.prisma.client.$queryRaw<{ id: bigint }[]>`
      WITH RECURSIVE subtree AS (
        SELECT id FROM department WHERE id = ${rootId} AND club_id = ${me.clubId} AND deleted_at = 0
        UNION ALL
        SELECT d.id FROM department d
        INNER JOIN subtree s ON d.parent_id = s.id
        WHERE d.club_id = ${me.clubId} AND d.deleted_at = 0
      )
      SELECT id FROM subtree
    `;
    return rows.map((row) => row.id);
  }

  private async resolveParentId(me: MemberContext, raw: string | null): Promise<bigint | null> {
    if (raw === null || raw === undefined || raw === '') return null;
    const parentId = parseId(raw);
    const parent = await this.prisma.client.department.findFirst({
      where: { id: parentId, clubId: me.clubId },
      select: { id: true },
    });
    if (parent === null) {
      throw new BizException(ErrorCode.NOT_FOUND, '上级部门不存在');
    }
    return parentId;
  }

  private async resolveMemberId(me: MemberContext, raw: string): Promise<bigint> {
    const memberId = parseId(raw);
    const member = await this.prisma.client.member.findFirst({
      where: { id: memberId, clubId: me.clubId },
      select: { id: true },
    });
    if (member === null) {
      throw new BizException(ErrorCode.NOT_FOUND, '指定的负责人不是本社团成员');
    }
    return memberId;
  }

  private async findOwned(
    me: MemberContext,
    id: bigint,
  ): Promise<{ id: bigint }> {
    const row = await this.prisma.client.department.findFirst({
      where: { id, clubId: me.clubId },
      select: { id: true },
    });
    if (row === null) throw new BizException(ErrorCode.NOT_FOUND, '部门不存在');
    return row;
  }
}

function toNode(row: DepartmentRow): DepartmentNodeVo {
  return {
    id: row.id.toString(),
    parentId: row.parentId?.toString() ?? null,
    name: row.name,
    description: row.description,
    sort: row.sort,
    status: row.status,
    leader:
      row.leader === null
        ? null
        : { id: row.leader.id.toString(), realName: row.leader.user.realName },
    memberCount: row._count.members,
    children: [],
  };
}

function buildTree(rows: DepartmentRow[]): DepartmentNodeVo[] {
  const nodes = new Map<string, DepartmentNodeVo>();
  for (const row of rows) {
    nodes.set(row.id.toString(), toNode(row));
  }

  const roots: DepartmentNodeVo[] = [];
  for (const node of nodes.values()) {
    if (node.parentId === null) {
      roots.push(node);
      continue;
    }
    const parent = nodes.get(node.parentId);
    // 父部门被停用时不丢掉子节点，挂到根上仍然可见
    if (parent === undefined) {
      roots.push(node);
      continue;
    }
    parent.children.push(node);
  }
  return roots;
}
