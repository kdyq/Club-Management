/** 审批引擎的请求与响应类型，前后端共用。 */

export interface ApprovalTaskVo {
  id: string;
  /** 属于哪个审批实例 */
  instanceId: string;
  /** 节点序号 */
  seq: number;
  approverMemberId: string;
  approverName: string;
  /** 1 待审批 / 2 已同意 / 3 已拒绝 / 4 已转交 / 5 已超时 */
  status: number;
  opinion: string | null;
  handledAt: string | null;
  createdAt: string;
}

export interface ApprovalInstanceVo {
  id: string;
  /** 实例标题，提交时写入，待办与详情直接展示，不必回查业务表 */
  title: string;
  bizType: string;
  bizId: string;
  flowName: string;
  applicantMemberId: string;
  applicantName: string;
  /** 1 审批中 / 2 已通过 / 3 已驳回 / 4 已撤销 */
  status: number;
  currentSeq: number;
  submitAt: string;
  finishAt: string | null;
  formData: Record<string, unknown> | null;
  tasks: ApprovalTaskVo[];
}

/** 我的待办 / 我的申请列表项：带上业务对象的标题，方便直接展示 */
export interface ApprovalTaskListItemVo extends ApprovalTaskVo {
  title: string;
  bizType: string;
}

export interface ApprovalQuery {
  page?: number;
  pageSize?: number;
  status?: number;
}
