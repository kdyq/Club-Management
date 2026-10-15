/** 经费链路枚举：流水、预算、会费、凭证。 */

/** 收支方向。金额永远存正数，方向由本枚举决定。 */
export const FundType = {
  /** 收入 */
  INCOME: 1,
  /** 支出 */
  EXPENSE: 2,
} as const;
export type FundType = (typeof FundType)[keyof typeof FundType];

export const FUND_TYPE_LABEL: Record<FundType, string> = {
  [FundType.INCOME]: '收入',
  [FundType.EXPENSE]: '支出',
};

/**
 * 流水状态。财务流水**只能作废，绝不删除**，否则审计链断裂。
 * 作废时必须写 voidReason。
 */
export const FundTransactionStatus = {
  /** 待审批 */
  PENDING: 1,
  /** 已入账 */
  POSTED: 2,
  /** 已作废 */
  VOIDED: 3,
} as const;
export type FundTransactionStatus =
  (typeof FundTransactionStatus)[keyof typeof FundTransactionStatus];

export const FUND_TRANSACTION_STATUS_LABEL: Record<FundTransactionStatus, string> = {
  [FundTransactionStatus.PENDING]: '待审批',
  [FundTransactionStatus.POSTED]: '已入账',
  [FundTransactionStatus.VOIDED]: '已作废',
};

export const FeeStatus = {
  /** 未缴 */
  UNPAID: 1,
  /** 部分缴纳 */
  PARTIAL: 2,
  /** 已缴清 */
  PAID: 3,
  /** 已减免 */
  WAIVED: 4,
} as const;
export type FeeStatus = (typeof FeeStatus)[keyof typeof FeeStatus];

export const FEE_STATUS_LABEL: Record<FeeStatus, string> = {
  [FeeStatus.UNPAID]: '未缴',
  [FeeStatus.PARTIAL]: '部分缴纳',
  [FeeStatus.PAID]: '已缴清',
  [FeeStatus.WAIVED]: '已减免',
};

/** 预算状态。取值与 schema 的注释一致：1 草稿 / 2 审批中 / 3 已通过 / 4 已驳回 / 5 已关闭 */
export const BudgetStatus = {
  /** 草稿 */
  DRAFT: 1,
  /** 审批中 */
  PENDING: 2,
  /** 已通过 */
  APPROVED: 3,
  /** 已驳回 */
  REJECTED: 4,
  /** 已关闭 */
  CLOSED: 5,
} as const;
export type BudgetStatus = (typeof BudgetStatus)[keyof typeof BudgetStatus];

export const BUDGET_STATUS_LABEL: Record<BudgetStatus, string> = {
  [BudgetStatus.DRAFT]: '草稿',
  [BudgetStatus.PENDING]: '审批中',
  [BudgetStatus.APPROVED]: '已通过',
  [BudgetStatus.REJECTED]: '已驳回',
  [BudgetStatus.CLOSED]: '已关闭',
};

/** 经费账户类型：现金 / 银行卡 / 线上收款 */
export const FundAccountType = {
  CASH: 1,
  BANK: 2,
  ONLINE: 3,
} as const;
export type FundAccountType = (typeof FundAccountType)[keyof typeof FundAccountType];

export const FUND_ACCOUNT_TYPE_LABEL: Record<FundAccountType, string> = {
  [FundAccountType.CASH]: '现金',
  [FundAccountType.BANK]: '银行卡',
  [FundAccountType.ONLINE]: '线上收款',
};
