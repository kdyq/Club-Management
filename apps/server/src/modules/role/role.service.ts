import { Injectable } from '@nestjs/common';
import {
  DATA_SCOPE_LABEL,
  DataScope,
  ErrorCode,
  normalizePage,
  skipOf,
  type PageResult,
  type RoleVo,
} from '@club/shared';
import { BizException } from '../../common/exceptions/biz.exception.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import type { MemberContext } from '../../common/types/member-context.js';
import { AssignPermissionsDto, CreateRoleDto, QueryRoleDto, UpdateRoleDto } from './dto/role.dto.js';

@Injectable()
export class RoleService {
  constructor(private readonly prisma: PrismaService) {}

  async page(me: MemberContext, query: QueryRoleDto): Promise<PageResult<RoleVo>> {
    const { page, pageSize } = normalizePage(query);

    const filters: Record<string, unknown> = {};
    if (query.keyword !== undefined && query.keyword !== '') {
      const keyword = query.keyword.trim();
      filters.OR = [{ name: { contains: keyword } }, { code: { contains: keyword } }];
    }
    if (query.status !== undefined) filters.status = query.status;

    const where = { clubId: me.clubId, ...filters };

    const [total, rows] = await Promise.all([
      this.prisma.client.role.count({ where }),
      this.prisma.client.role.findMany({
        where,
        orderBy: [{ sort: 'asc' }, { id: 'asc' }],
        skip: skipOf(page, pageSize),
        take: pageSize,
        include: {
          permissions: { include: { permission: { select: { code: true } } } },
          _count: { select: { members: true } },
        },
      }),
    ]);

    return { list: rows.map((row) => toRoleVo(row)), total, page, pageSize };
  }

  /** 全部角色，给分配角色之类的下拉用 */
  async options(me: MemberContext): Promise<{ id: string; name: string; code: string }[]> {
    const rows = await this.prisma.client.role.findMany({
      where: { clubId: me.clubId, status: 1 },
      orderBy: [{ sort: 'asc' }],
      select: { id: true, name: true, code: true },
    });
    return rows.map((row) => ({ id: row.id.toString(), name: row.name, code: row.code }));
  }

  async create(me: MemberContext, dto: CreateRoleDto): Promise<RoleVo> {
    const exists = await this.prisma.client.role.findFirst({
      where: { clubId: me.clubId, code: dto.code },
      select: { id: true },
    });
    if (exists !== null) {
      throw new BizException(ErrorCode.DUPLICATE_RECORD, `角色编码 ${dto.code} 已存在`);
    }

    const row = await this.prisma.client.role.create({
      data: {
        clubId: me.clubId,
        name: dto.name,
        code: dto.code,
        dataScope: dto.dataScope,
        description: dto.description ?? null,
        sort: dto.sort ?? 0,
        isSystem: false,
        status: 1,
        createdBy: me.userId,
      },
      include: {
        permissions: { include: { permission: { select: { code: true } } } },
        _count: { select: { members: true } },
      },
    });
    return toRoleVo(row);
  }

  async update(me: MemberContext, id: bigint, dto: UpdateRoleDto): Promise<RoleVo> {
    const role = await this.findOwned(me, id);

    // 系统内置角色的编码与数据范围不允许改，避免把超管角色改废
    if (role.isSystem && dto.dataScope !== undefined && dto.dataScope !== role.dataScope) {
      throw new BizException(ErrorCode.BUSINESS_RULE_VIOLATED, '内置角色的数据范围不允许修改');
    }

    const row = await this.prisma.client.role.update({
      where: { id },
      data: {
        name: dto.name,
        dataScope: dto.dataScope,
        description: dto.description,
        sort: dto.sort,
        status: dto.status,
        updatedBy: me.userId,
      },
      include: {
        permissions: { include: { permission: { select: { code: true } } } },
        _count: { select: { members: true } },
      },
    });
    return toRoleVo(row);
  }

  async remove(me: MemberContext, id: bigint): Promise<void> {
    const role = await this.findOwned(me, id);
    if (role.isSystem) {
      throw new BizException(ErrorCode.BUSINESS_RULE_VIOLATED, '内置角色不允许删除');
    }

    const assigned = await this.prisma.client.memberRole.count({ where: { roleId: id } });
    if (assigned > 0) {
      throw new BizException(
        ErrorCode.BUSINESS_RULE_VIOLATED,
        `该角色还有 ${assigned} 个成员在使用，请先解除分配`,
      );
    }

    await this.prisma.client.rolePermission.deleteMany({ where: { roleId: id } });
    await this.prisma.client.role.delete({ where: { id } });
  }

  async permissionCodes(me: MemberContext, id: bigint): Promise<string[]> {
    await this.findOwned(me, id);
    const rows = await this.prisma.client.rolePermission.findMany({
      where: { roleId: id },
      include: { permission: { select: { code: true } } },
    });
    return rows.map((row) => row.permission.code);
  }

  /**
   * 覆盖式分配权限。先清空再写入，放在事务里，避免中途失败留下半个角色的权限。
   * 只接受数据库里真实存在的权限码，传错码直接报错而不是静默忽略。
   */
  async assignPermissions(me: MemberContext, id: bigint, dto: AssignPermissionsDto): Promise<string[]> {
    await this.findOwned(me, id);

    const permissions = await this.prisma.client.permission.findMany({
      where: { code: { in: dto.permissionCodes } },
      select: { id: true, code: true },
    });

    const foundCodes = new Set(permissions.map((p) => p.code));
    const unknown = dto.permissionCodes.filter((code) => !foundCodes.has(code));
    if (unknown.length > 0) {
      throw new BizException(
        ErrorCode.PARAM_INVALID,
        `以下权限码不存在：${unknown.slice(0, 5).join('、')}${unknown.length > 5 ? ' 等' : ''}`,
      );
    }

    await this.prisma.transaction(async (tx) => {
      await tx.rolePermission.deleteMany({ where: { roleId: id } });
      if (permissions.length > 0) {
        await tx.rolePermission.createMany({
          data: permissions.map((p) => ({ roleId: id, permissionId: p.id })),
        });
      }
    });

    return dto.permissionCodes;
  }

  private async findOwned(
    me: MemberContext,
    id: bigint,
  ): Promise<{ id: bigint; isSystem: boolean; dataScope: number }> {
    const role = await this.prisma.client.role.findFirst({
      where: { id, clubId: me.clubId },
      select: { id: true, isSystem: true, dataScope: true },
    });
    if (role === null) throw new BizException(ErrorCode.NOT_FOUND, '角色不存在');
    return role;
  }
}

interface RoleRow {
  id: bigint;
  name: string;
  code: string;
  dataScope: number;
  description: string | null;
  isSystem: boolean;
  sort: number;
  status: number;
  permissions: { permission: { code: string } }[];
  _count: { members: number };
}

function toRoleVo(row: RoleRow): RoleVo {
  return {
    id: row.id.toString(),
    name: row.name,
    code: row.code,
    dataScope: row.dataScope,
    dataScopeLabel: DATA_SCOPE_LABEL[row.dataScope as DataScope] ?? String(row.dataScope),
    description: row.description,
    isSystem: row.isSystem,
    sort: row.sort,
    status: row.status,
    permissionCodes: row.permissions.map((p) => p.permission.code),
    memberCount: row._count.members,
  };
}
