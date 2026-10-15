/**
 * 数据范围（开发文档 7.5 节第二层）。
 *
 * 在 Service 层统一调用这里的函数生成 where 片段，**不要在每个 Service 里手写**，
 * 否则迟早漏掉一个接口导致越权。导出接口同样要过这一层。
 *
 * 与开发文档草图的一处偏差：草图中 DataScope.ALL 返回 {}，即连租户条件也不加。
 * 这里改为**租户条件永远加上**，ALL 只是「在租户内不再追加限制」。
 * 理由是红线 2 要求每个查询都必须带租户过滤；真要跨社团，那属于平台级角色，
 * 应该另开一个标志位而不是复用 dataScope。当前只有一个社团，行为无差别。
 */
import { DataScope } from '@club/shared';
import { ErrorCode } from '@club/shared';
import { BizException } from '../exceptions/biz.exception.js';
import type { MemberContext } from '../types/member-context.js';
import type { PrismaService } from './prisma.service.js';

export type ScopeWhere = Record<string, unknown>;

interface ScopeResourceSpec {
  /** 租户字段 */
  club: string;
  /** 部门字段，null 表示该表本身没有部门列 */
  dept: string | null;
  /**
   * 本表没有 dept 列、但要按部门限定时，走这条关系：
   * 例如活动是按「组织者所在部门」来限制，而不是活动自己有部门。
   */
  deptVia?: { relation: string; field: string };
  /** 「仅本人」判定用的字段 */
  owner: string;
}

/**
 * 资源 → 字段映射。**新增模块时在这里登记**，否则 buildScopeWhere 不认识它，
 * 会退化成「仅本人」而不是静默放行（宁可变严不可放松）。
 */
export const SCOPE_RESOURCES = {
  member: { club: 'clubId', dept: 'deptId', owner: 'id' },
  activity: {
    club: 'clubId',
    dept: null,
    deptVia: { relation: 'organizer', field: 'deptId' },
    owner: 'organizerMemberId',
  },
} as const satisfies Record<string, ScopeResourceSpec>;

export type ScopeResource = keyof typeof SCOPE_RESOURCES;

/**
 * 求某部门及其所有子孙部门的 id 集合。MySQL 8 的递归 CTE，社团级数据量足够。
 */
export async function deptSubtreeIds(
  prisma: PrismaService,
  clubId: bigint,
  rootDeptId: bigint,
): Promise<bigint[]> {
  // 手写 SQL 不走软删除扩展，deleted_at 条件必须自己带
  const rows = await prisma.client.$queryRaw<{ id: bigint }[]>`
    WITH RECURSIVE subtree AS (
      SELECT id FROM department
      WHERE id = ${rootDeptId} AND club_id = ${clubId} AND deleted_at = 0
      UNION ALL
      SELECT d.id FROM department d
      INNER JOIN subtree s ON d.parent_id = s.id
      WHERE d.club_id = ${clubId} AND d.deleted_at = 0
    )
    SELECT id FROM subtree
  `;
  return rows.map((row) => row.id);
}

/**
 * 生成数据范围 where 片段。调用方把它合并进自己的 where，或直接用返回值。
 */
export async function buildScopeWhere(
  prisma: PrismaService,
  me: MemberContext,
  resource: ScopeResource,
): Promise<ScopeWhere> {
  const spec = SCOPE_RESOURCES[resource];
  // 租户隔离永远生效，与数据范围无关
  const where: ScopeWhere = { [spec.club]: me.clubId };

  switch (me.maxDataScope) {
    case DataScope.ALL:
    case DataScope.CLUB:
      return where;

    case DataScope.DEPT_AND_BELOW: {
      if (me.deptId === null) {
        return { ...where, [spec.owner]: me.memberId };
      }
      const ids = await deptSubtreeIds(prisma, me.clubId, me.deptId);
      return { ...where, ...deptFilter(spec, { in: ids }) };
    }

    case DataScope.DEPT: {
      if (me.deptId === null) {
        return { ...where, [spec.owner]: me.memberId };
      }
      return { ...where, ...deptFilter(spec, me.deptId) };
    }

    default:
      return { ...where, [spec.owner]: me.memberId };
  }
}

/** 有 dept 列就直接过滤，没有就走 deptVia 的关系 */
function deptFilter(spec: ScopeResourceSpec, value: unknown): ScopeWhere {
  if (spec.dept !== null) return { [spec.dept]: value };
  if (spec.deptVia !== undefined) {
    return { [spec.deptVia.relation]: { [spec.deptVia.field]: value } };
  }
  // 既没有 dept 也没有 deptVia，只能退到本人，交给调用方兜底
  return {};
}

/**
 * 单条记录操作（改 / 删 / 详情）的范围校验。
 * 记录不存在 → 404；存在但不在范围内 → 403。两者分开，前端才知道该提示什么。
 *
 * 用 findFirst 而不是 findUnique，因为要一次性带上范围条件，
 * 避免「先查到再判断」这段空窗。
 */
export async function findInScope<T>(
  prisma: PrismaService,
  me: MemberContext,
  resource: ScopeResource,
  id: bigint,
): Promise<T> {
  const scopeWhere = await buildScopeWhere(prisma, me, resource);
  // deletedAt 由软删除扩展自动注入，这里不重复写
  const model = (
    prisma.client as unknown as Record<string, { findFirst: (args: unknown) => Promise<T | null> }>
  )[resource];
  const record = await model.findFirst({ where: { ...scopeWhere, id } });
  if (record === null) {
    // 判断是「不存在」还是「越权」，给出准确的状态码
    const anyModel = (
      prisma.client as unknown as Record<string, { findFirst: (args: unknown) => Promise<unknown> }>
    )[resource];
    const exists = await anyModel.findFirst({ where: { id }, select: { id: true } });
    if (exists === null) throw new BizException(ErrorCode.NOT_FOUND);
    throw new BizException(ErrorCode.OUT_OF_DATA_SCOPE);
  }
  return record;
}
