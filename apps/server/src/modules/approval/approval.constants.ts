/** 审批引擎的常量与类型。审批是横切能力，业务模块只实现回调。 */

/** 审批节点超时动作，与 shared 的 ApprovalTimeoutAction 对齐 */
export const TIMEOUT_ACTION = {
  NOTIFY: 1,
  AUTO_APPROVE: 2,
  AUTO_REJECT: 3,
  TRANSFER: 4,
} as const;

/** 节点审批人来源 */
export const APPROVER_TYPE = {
  /** 指定角色 */
  ROLE: 1,
  /** 指定成员 */
  MEMBER: 2,
  /** 申请人所在部门负责人 */
  DEPT_LEADER: 3,
  /** 申请人的上级（本项目里取社长） */
  SUPERIOR: 4,
} as const;

/** 会签模式 */
export const APPROVE_MODE = {
  /** 或签：任一人同意即通过 */
  ANY: 1,
  /** 会签：全部同意才通过 */
  ALL: 2,
} as const;

export interface SubmitApprovalInput {
  clubId: bigint;
  bizType: string;
  bizId: bigint;
  title: string;
  applicantMemberId: bigint;
  formData?: Record<string, unknown>;
}

export interface ApprovalDecision {
  taskId: bigint;
  approverMemberId: bigint;
  opinion?: string;
  attachmentFileId?: bigint;
}
