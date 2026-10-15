import { Injectable } from '@nestjs/common';
import type { PermissionNodeVo } from '@club/shared';
import { PrismaService } from '../../common/prisma/prisma.service.js';

interface PermissionRow {
  id: bigint;
  parentId: bigint | null;
  name: string;
  code: string;
  type: number;
  path: string | null;
  icon: string | null;
  sort: number;
}

@Injectable()
export class PermissionService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 权限树。permission 表同时承担菜单树职责，这里一次查全表再在内存里拼，
   * 权限总量百来条，比递归查询简单也不会慢。
   */
  async tree(): Promise<PermissionNodeVo[]> {
    const rows = await this.prisma.client.permission.findMany({
      where: { status: 1 },
      orderBy: [{ sort: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        parentId: true,
        name: true,
        code: true,
        type: true,
        path: true,
        icon: true,
        sort: true,
      },
    });

    const nodes = new Map<string, PermissionNodeVo>();
    for (const row of rows as PermissionRow[]) {
      nodes.set(row.id.toString(), {
        id: row.id.toString(),
        parentId: row.parentId?.toString() ?? null,
        name: row.name,
        code: row.code,
        type: row.type,
        path: row.path,
        icon: row.icon,
        sort: row.sort,
        children: [],
      });
    }

    const roots: PermissionNodeVo[] = [];
    for (const node of nodes.values()) {
      if (node.parentId === null) {
        roots.push(node);
        continue;
      }
      const parent = nodes.get(node.parentId);
      if (parent === undefined) {
        // 父节点被停用或缺失时不要丢掉子节点，挂到根上仍然可见
        roots.push(node);
        continue;
      }
      parent.children.push(node);
    }
    return roots;
  }

  /** 扁平清单，给前端做按码匹配用 */
  async flat(): Promise<{ code: string; name: string; type: number }[]> {
    const rows = await this.prisma.client.permission.findMany({
      where: { status: 1 },
      orderBy: [{ type: 'asc' }, { sort: 'asc' }],
      select: { code: true, name: true, type: true },
    });
    return rows;
  }
}
