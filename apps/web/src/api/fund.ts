import type {
  FeeStandardVo,
  FundAccountVo,
  FundBudgetVo,
  FundCategoryVo,
  FundOverviewVo,
  FundTransactionVo,
  MemberFeeVo,
  PageResult,
  ReconcileResultVo,
} from '@club/shared';
import { request } from './http';

export const fundApi = {
  accounts: (): Promise<FundAccountVo[]> => request.get<FundAccountVo[]>('/fund/accounts'),
  createAccount: (data: {
    name: string;
    accountNo?: string;
    initialAmount?: number;
    isDefault?: boolean;
  }): Promise<FundAccountVo> => request.post<FundAccountVo>('/fund/accounts', data),

  categories: (): Promise<FundCategoryVo[]> => request.get<FundCategoryVo[]>('/fund/categories'),
  createCategory: (data: {
    name: string;
    type: number;
    parentId?: string | null;
    sort?: number;
  }): Promise<FundCategoryVo> => request.post<FundCategoryVo>('/fund/categories', data),

  overview: (): Promise<FundOverviewVo> => request.get<FundOverviewVo>('/fund/overview'),

  transactions: (params: Record<string, unknown>): Promise<PageResult<FundTransactionVo>> =>
    request.get<PageResult<FundTransactionVo>>('/fund/transactions', { params }),
  createTransaction: (data: Record<string, unknown>): Promise<FundTransactionVo> =>
    request.post<FundTransactionVo>('/fund/transactions', data),
  voidTransaction: (id: string, reason: string): Promise<FundTransactionVo> =>
    request.post<FundTransactionVo>(`/fund/transactions/${id}/void`, { reason }),
  attachVouchers: (id: string, fileIds: string[]): Promise<{ count: number }> =>
    request.post(`/fund/transactions/${id}/vouchers`, { fileIds }),

  budgets: (params: Record<string, unknown>): Promise<PageResult<FundBudgetVo>> =>
    request.get<PageResult<FundBudgetVo>>('/fund/budgets', { params }),
  createBudget: (data: Record<string, unknown>): Promise<FundBudgetVo> =>
    request.post<FundBudgetVo>('/fund/budgets', data),
  submitBudget: (id: string): Promise<{ approvalInstanceId: string }> =>
    request.post(`/fund/budgets/${id}/submit`, {}),
  closeBudget: (id: string): Promise<FundBudgetVo> => request.post<FundBudgetVo>(`/fund/budgets/${id}/close`, {}),

  feeStandards: (): Promise<FeeStandardVo[]> =>
    request.get<FeeStandardVo[]>('/fund/fee-standards'),
  createFeeStandard: (data: Record<string, unknown>): Promise<FeeStandardVo> =>
    request.post<FeeStandardVo>('/fund/fee-standards', data),
  remind: (id: string): Promise<{ notified: number; skipped: boolean }> =>
    request.post(`/fund/fee-standards/${id}/remind`, {}),

  fees: (params: Record<string, unknown>): Promise<PageResult<MemberFeeVo>> =>
    request.get<PageResult<MemberFeeVo>>('/fund/fees', { params }),
  pay: (
    id: string,
    data: { paidAmount: number; payMethod: number; voucherFileId?: string; remark?: string },
  ): Promise<{ fee: MemberFeeVo; transactionId: string | null }> =>
    request.post(`/fund/fees/${id}/pay`, data),
  waive: (id: string, reason: string): Promise<MemberFeeVo> =>
    request.post<MemberFeeVo>(`/fund/fees/${id}/waive`, { reason }),

  arrears: (feeStandardId?: string): Promise<{
    totalMembers: number;
    unpaidCount: number;
    partialCount: number;
    paidCount: number;
    waivedCount: number;
    shouldTotal: string;
    paidTotal: string;
    outstandingTotal: string;
  }> => request.get('/fund/arrears', { params: { feeStandardId } }),

  reconcile: (): Promise<ReconcileResultVo & { assetQty?: unknown }> =>
    request.post('/admin/reconcile', {}),
};

export const notificationApi = {
  inbox: (params: { onlyUnread?: boolean; page?: number; pageSize?: number } = {}): Promise<{
    list: { id: string; title: string; content: string; type: number; isRead: boolean; createdAt: string }[];
    total: number;
    unread: number;
  }> => request.get('/notifications', { params }),

  markRead: (id: string): Promise<null> => request.post<null>(`/notifications/${id}/read`, {}),
  markAllRead: (): Promise<{ count: number }> => request.post('/notifications/read-all', {}),
};

export const fileApi = {
  upload: async (
    file: File,
    options: { scope?: number; bizType?: string; bizId?: string } = {},
  ): Promise<{ id: string; originalName: string }> => {
    const form = new FormData();
    form.append('file', file);
    const params = new URLSearchParams();
    if (options.scope !== undefined) params.set('scope', String(options.scope));
    if (options.bizType !== undefined) params.set('bizType', options.bizType);
    if (options.bizId !== undefined) params.set('bizId', options.bizId);
    const query = params.toString();
    return request.post(`/files/upload${query === '' ? '' : `?${query}`}`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  list: (params: { bizType?: string; bizId?: string } = {}): Promise<{ list: unknown[]; total: number }> =>
    request.get('/files', { params }),
  remove: (id: string): Promise<null> => request.delete<null>(`/files/${id}`),
};

export type {
  FeeStandardVo,
  FundAccountVo,
  FundBudgetVo,
  FundCategoryVo,
  FundOverviewVo,
  FundTransactionVo,
  MemberFeeVo,
};
