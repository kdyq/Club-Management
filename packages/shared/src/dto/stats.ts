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

/** 数据看板。所有数字都是实时查询得出，没有写死的展示值 */
export interface DashboardVo {
  memberCount: number;
  clubMemberCount: number;
  deptCount: number;
  activityCount: number;
  ongoingCount: number;
  /** 我的待办审批数 */
  pendingApprovalCount: number;
  /** 我的未读站内信数 */
  unreadCount: number;
  /** 近半年发放的积分合计 */
  monthPoints: number;
  deptDistribution: { name: string; count: number }[];
  activityStatusDistribution: { status: number; label: string; count: number }[];
  memberGrowth: { month: string; count: number }[];
  topMembers: { id: string; name: string; deptName: string | null; points: number }[];
}
