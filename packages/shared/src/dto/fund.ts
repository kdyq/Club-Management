/** 经费链路的请求与响应类型，前后端共用。 */

export interface FundAccountVo {
  id: string;
  name: string;
  accountNo: string | null;
  initialAmount: string;
  /** 当前余额：由流水算出，不存字段 */
  balance: string;
  incomeTotal: string;
  expenseTotal: string;
  isDefault: boolean;
  status: number;
  transactionCount: number;
}

export interface FundCategoryVo {
  id: string;
  parentId: string | null;
  name: string;
  type: number;
  sort: number;
  status: number;
  children: FundCategoryVo[];
}

export interface FundTransactionVo {
  id: string;
  accountId: string;
  accountName: string | null;
  categoryId: string | null;
  categoryName: string | null;
  type: number;
  typeLabel: string;
  amount: string;
  title: string;
  occurredAt: string;
  bizType: string | null;
  bizId: string | null;
  handlerName: string | null;
  status: number;
  statusLabel: string;
  approvalInstanceId: string | null;
  voidReason: string | null;
  remark: string | null;
  voucherCount: number;
  createdAt: string;
}

export interface FundTransactionQuery {
  page?: number;
  pageSize?: number;
  keyword?: string;
  accountId?: string;
  categoryId?: string;
  type?: number;
  status?: number;
  /** 起止日期，按 occurredAt 过滤 */
  dateFrom?: string;
  dateTo?: string;
}

export interface CreateTransactionDto {
  accountId: string;
  categoryId?: string | null;
  type: number;
  amount: number;
  title: string;
  occurredAt: string;
  handlerMemberId?: string | null;
  remark?: string;
  /** 是否走审批，默认 false（直接入账） */
  needApproval?: boolean;
  /** 凭证文件 id 列表 */
  voucherFileIds?: string[];
}

export interface FundOverviewVo {
  totalBalance: string;
  totalIncome: string;
  totalExpense: string;
  monthIncome: string;
  monthExpense: string;
  accounts: FundAccountVo[];
  /** 按科目聚合的支出，用于公示页的趋势与构成 */
  expenseByCategory: { categoryId: string | null; categoryName: string; amount: string }[];
  /** 近 6 个月的收支，用于趋势线 */
  monthlyTrend: { month: string; income: string; expense: string }[];
}

export interface FundBudgetVo {
  id: string;
  name: string;
  termId: string | null;
  activityId: string | null;
  categoryId: string | null;
  categoryName: string | null;
  amount: string;
  usedAmount: string;
  /** 执行率百分比，保留一位小数 */
  executionRate: number;
  periodStart: string | null;
  periodEnd: string | null;
  status: number;
  statusLabel: string;
  approvalInstanceId: string | null;
  createdAt: string;
}

export interface FundBudgetQuery {
  page?: number;
  pageSize?: number;
  keyword?: string;
  status?: number;
  activityId?: string;
}

export interface CreateBudgetDto {
  name: string;
  amount: number;
  categoryId?: string | null;
  activityId?: string | null;
  periodStart?: string;
  periodEnd?: string;
}

export interface FeeStandardVo {
  id: string;
  name: string;
  termId: string;
  termName: string;
  amount: string;
  dueDate: string;
  targetType: number;
  targetTypeLabel: string;
  status: number;
  /** 应缴人数与已缴清人数 */
  totalCount: number;
  paidCount: number;
  paidAmount: string;
  shouldAmount: string;
}

export interface MemberFeeVo {
  id: string;
  feeStandardId: string;
  standardName: string;
  memberId: string;
  memberName: string;
  deptName: string | null;
  shouldAmount: string;
  paidAmount: string;
  paidAt: string | null;
  payMethod: number | null;
  payMethodLabel: string | null;
  status: number;
  statusLabel: string;
  remark: string | null;
  dueDate: string;
}

export interface FeeQuery {
  page?: number;
  pageSize?: number;
  feeStandardId?: string;
  memberId?: string;
  status?: number;
  keyword?: string;
}

export interface CreateFeeStandardDto {
  name: string;
  amount: number;
  dueDate: string;
  termId?: string;
  targetType?: number;
  targetIds?: string[];
}

export interface PayFeeDto {
  paidAmount: number;
  payMethod: number;
  voucherFileId?: string;
  remark?: string;
  /** 是否同时生成一笔收入流水，默认 true */
  createTransaction?: boolean;
}

export interface ReconcileResultVo {
  memberPoints: { checked: number; fixed: number; details: string[] };
  budgetUsed: { checked: number; fixed: number; details: string[] };
  feeStatus: { checked: number; fixed: number; details: string[] };
  /** 物资可借数量也要对账，它同样是缓存字段 */
  assetQty: { checked: number; fixed: number; details: string[] };
  durationMs: number;
  runAt: string;
}

/** 站内信收件箱 */
export interface NotificationItemVo {
  id: string;
  title: string;
  content: string;
  type: number;
  isRead: boolean;
  createdAt: string;
}

export interface NotificationInboxVo {
  list: NotificationItemVo[];
  total: number;
  unread: number;
}
