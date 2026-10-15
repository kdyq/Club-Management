/** 统计相关的响应类型，前后端共用。 */

/** 登录页展示的社团规模，无需登录即可读取 */
export interface PublicOverviewVo {
  clubName: string;
  shortName: string | null;
  foundedYear: number | null;
  memberCount: number;
  deptCount: number;
}

/** 工作台概览。memberCount 受当前登录者的数据范围限制 */
export interface OverviewVo {
  memberCount: number;
  /** 全社团在册人数，作为对比基准 */
  clubMemberCount: number;
  deptCount: number;
  roleCount: number;
  permissionCount: number;
  maxDataScope: number;
  maxDataScopeLabel: string;
  scopeDescription: string;
}
