import type {
  ApprovalInstanceVo,
  ApprovalTaskListItemVo,
  PageResult,
} from '@club/shared';
import { request } from './http';

export const approvalApi = {
  /** 我的待办，默认只返回待审批的 */
  myTasks: (params: { page?: number; pageSize?: number; status?: number } = {}): Promise<
    PageResult<ApprovalTaskListItemVo>
  > => request.get<PageResult<ApprovalTaskListItemVo>>('/approvals/tasks', { params }),

  myApplications: (params: { page?: number; pageSize?: number; status?: number } = {}): Promise<
    PageResult<ApprovalInstanceVo>
  > => request.get<PageResult<ApprovalInstanceVo>>('/approvals/applications', { params }),

  detail: (id: string): Promise<ApprovalInstanceVo> =>
    request.get<ApprovalInstanceVo>(`/approvals/${id}`),

  approve: (taskId: string, opinion?: string): Promise<{ finished: boolean; status: number }> =>
    request.post(`/approvals/tasks/${taskId}/approve`, { opinion }),

  reject: (taskId: string, opinion: string): Promise<{ finished: boolean; status: number }> =>
    request.post(`/approvals/tasks/${taskId}/reject`, { opinion }),

  revoke: (instanceId: string): Promise<null> =>
    request.post<null>(`/approvals/${instanceId}/revoke`, {}),
};

export type { ApprovalInstanceVo, ApprovalTaskListItemVo };
