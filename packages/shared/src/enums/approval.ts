/** 审批引擎枚举。审批是横切能力，活动/经费/预算/请假/场地/换班都复用它。 */

/** 审批用到的业务类型，对应 approval_instance.biz_type */
export const BizType = {
  ACTIVITY: 'activity',
  FUND: 'fund',
  BUDGET: 'budget',
  FEE: 'fee',
  LEAVE: 'leave',
  VENUE: 'venue',
  SWAP: 'swap',
} as const;
export type BizType = (typeof BizType)[keyof typeof BizType];

export const BIZ_TYPE_LABEL: Record<BizType, string> = {
  [BizType.ACTIVITY]: '活动立项',
  [BizType.FUND]: '经费收支',
  [BizType.BUDGET]: '预算申请',
  [BizType.FEE]: '会费',
  [BizType.LEAVE]: '请假',
  [BizType.VENUE]: '场地预约',
  [BizType.SWAP]: '换班',
};

export const ApprovalInstanceStatus = {
  /** 审批中 */
  PENDING: 1,
  /** 已通过 */
  APPROVED: 2,
  /** 已驳回 */
  REJECTED: 3,
  /** 已撤销 */
  REVOKED: 4,
} as const;
export type ApprovalInstanceStatus =
  (typeof ApprovalInstanceStatus)[keyof typeof ApprovalInstanceStatus];

export const APPROVAL_INSTANCE_STATUS_LABEL: Record<ApprovalInstanceStatus, string> = {
  [ApprovalInstanceStatus.PENDING]: '审批中',
  [ApprovalInstanceStatus.APPROVED]: '已通过',
  [ApprovalInstanceStatus.REJECTED]: '已驳回',
  [ApprovalInstanceStatus.REVOKED]: '已撤销',
};

export const ApprovalTaskStatus = {
  /** 待审批 */
  PENDING: 1,
  /** 已同意 */
  AGREED: 2,
  /** 已拒绝 */
  REFUSED: 3,
  /** 已转交 */
  TRANSFERRED: 4,
  /** 已超时 */
  TIMEOUT: 5,
} as const;
export type ApprovalTaskStatus = (typeof ApprovalTaskStatus)[keyof typeof ApprovalTaskStatus];

export const APPROVAL_TASK_STATUS_LABEL: Record<ApprovalTaskStatus, string> = {
  [ApprovalTaskStatus.PENDING]: '待审批',
  [ApprovalTaskStatus.AGREED]: '已同意',
  [ApprovalTaskStatus.REFUSED]: '已拒绝',
  [ApprovalTaskStatus.TRANSFERRED]: '已转交',
  [ApprovalTaskStatus.TIMEOUT]: '已超时',
};

/** 审批节点会签模式 */
export const ApprovalNodeMode = {
  /** 或签：任一人同意即通过 */
  ANY: 1,
  /** 会签：全部同意才通过 */
  ALL: 2,
} as const;
export type ApprovalNodeMode = (typeof ApprovalNodeMode)[keyof typeof ApprovalNodeMode];

export const APPROVAL_NODE_MODE_LABEL: Record<ApprovalNodeMode, string> = {
  [ApprovalNodeMode.ANY]: '或签',
  [ApprovalNodeMode.ALL]: '会签',
};

/** 审批节点超时后的动作 */
export const ApprovalTimeoutAction = {
  /** 仅提醒 */
  NOTIFY: 1,
  /** 自动通过 */
  AUTO_APPROVE: 2,
  /** 自动驳回 */
  AUTO_REJECT: 3,
  /** 转交上级 */
  TRANSFER: 4,
} as const;
export type ApprovalTimeoutAction =
  (typeof ApprovalTimeoutAction)[keyof typeof ApprovalTimeoutAction];

export const APPROVAL_TIMEOUT_ACTION_LABEL: Record<ApprovalTimeoutAction, string> = {
  [ApprovalTimeoutAction.NOTIFY]: '仅提醒',
  [ApprovalTimeoutAction.AUTO_APPROVE]: '自动通过',
  [ApprovalTimeoutAction.AUTO_REJECT]: '自动驳回',
  [ApprovalTimeoutAction.TRANSFER]: '转交上级',
};

/** 通用审核状态，用于招新申请等只需一次性审核的场景 */
export const AuditStatus = {
  /** 待审核 */
  PENDING: 1,
  /** 已通过 */
  APPROVED: 2,
  /** 已拒绝 */
  REJECTED: 3,
  /** 已取消 */
  CANCELLED: 4,
} as const;
export type AuditStatus = (typeof AuditStatus)[keyof typeof AuditStatus];

export const AUDIT_STATUS_LABEL: Record<AuditStatus, string> = {
  [AuditStatus.PENDING]: '待审核',
  [AuditStatus.APPROVED]: '已通过',
  [AuditStatus.REJECTED]: '已拒绝',
  [AuditStatus.CANCELLED]: '已取消',
};
