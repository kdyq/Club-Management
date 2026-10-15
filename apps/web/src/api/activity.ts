import type {
  ActivityCategoryVo,
  ActivityQuery,
  ActivityVo,
  CheckinTokenVo,
  CheckinVo,
  LeaveVo,
  PageResult,
  PointRecordVo,
  RegistrationQuery,
  RegistrationVo,
} from '@club/shared';
import { request } from './http';

export interface CreateActivityPayload {
  title: string;
  categoryId?: string | null;
  summary?: string;
  content?: string;
  location?: string;
  startTime: string;
  endTime: string;
  signupStart?: string;
  signupEnd?: string;
  capacity?: number;
  needAudit?: boolean;
  contactInfo?: string;
  checkinType?: number;
  checkinStart?: string;
  checkinEnd?: string;
  points?: number;
  volunteerHours?: number;
  budgetAmount?: number;
}

export const activityApi = {
  page: (params: ActivityQuery): Promise<PageResult<ActivityVo>> =>
    request.get<PageResult<ActivityVo>>('/activities', { params }),

  detail: (id: string): Promise<ActivityVo> => request.get<ActivityVo>(`/activities/${id}`),

  create: (data: CreateActivityPayload): Promise<ActivityVo> =>
    request.post<ActivityVo>('/activities', data),

  update: (id: string, data: Partial<CreateActivityPayload> & { summaryReport?: string }): Promise<ActivityVo> =>
    request.put<ActivityVo>(`/activities/${id}`, data),

  remove: (id: string): Promise<null> => request.delete<null>(`/activities/${id}`),

  submit: (id: string): Promise<{ approvalInstanceId: string }> =>
    request.post(`/activities/${id}/submit`, {}),

  cancel: (id: string, reason?: string): Promise<ActivityVo> =>
    request.post<ActivityVo>(`/activities/${id}/cancel`, { reason }),

  archive: (id: string, summaryReport?: string): Promise<ActivityVo> =>
    request.post<ActivityVo>(`/activities/${id}/archive`, { summaryReport }),

  issuePoints: (
    id: string,
    options: { points?: number; onlyCheckedIn?: boolean; reason?: string } = {},
  ): Promise<{ issued: number; skipped: number }> =>
    request.post(`/activities/${id}/points`, options),

  categories: (): Promise<ActivityCategoryVo[]> =>
    request.get<ActivityCategoryVo[]>('/activities/categories'),

  createCategory: (data: { name: string; color?: string; sort?: number }): Promise<ActivityCategoryVo> =>
    request.post<ActivityCategoryVo>('/activities/categories', data),

  // ---- 报名 ----
  register: (id: string, data: { remark?: string } = {}): Promise<{ id: string; status: number; message: string }> =>
    request.post(`/activities/${id}/register`, data),

  registrations: (params: RegistrationQuery): Promise<PageResult<RegistrationVo>> =>
    request.get<PageResult<RegistrationVo>>('/activities/registrations', { params }),

  auditRegistration: (id: string, approved: boolean, remark?: string): Promise<RegistrationVo> =>
    request.post<RegistrationVo>(`/activities/registrations/${id}/audit`, { approved, remark }),

  auditAll: (activityId: string): Promise<{ approved: number }> =>
    request.post(`/activities/${activityId}/registrations/audit-all`, {}),

  cancelRegistration: (id: string): Promise<null> =>
    request.post<null>(`/activities/registrations/${id}/cancel`, {}),

  // ---- 签到 ----
  checkinToken: (id: string): Promise<CheckinTokenVo> =>
    request.get<CheckinTokenVo>(`/activities/${id}/checkin-token`),

  checkin: (id: string, token: string): Promise<{ checkinTime: string; statusLabel: string }> =>
    request.post(`/activities/${id}/checkin`, { token }),

  checkins: (params: RegistrationQuery): Promise<PageResult<CheckinVo>> =>
    request.get<PageResult<CheckinVo>>('/activities/checkins', { params }),

  makeup: (id: string, memberId: string, reason: string): Promise<{ checkinTime: string }> =>
    request.post(`/activities/${id}/makeup`, { memberId, reason }),

  markAbsent: (id: string): Promise<{ marked: number }> =>
    request.post(`/activities/${id}/mark-absent`, {}),

  // ---- 请假 ----
  applyLeave: (id: string, reason: string): Promise<LeaveVo> =>
    request.post<LeaveVo>(`/activities/${id}/leave`, { reason }),

  leaves: (params: RegistrationQuery): Promise<PageResult<LeaveVo>> =>
    request.get<PageResult<LeaveVo>>('/activities/leaves', { params }),

  auditLeave: (id: string, approved: boolean, remark?: string): Promise<LeaveVo> =>
    request.post<LeaveVo>(`/activities/leaves/${id}/audit`, { approved, remark }),

  // ---- 积分 ----
  points: (params: { page?: number; pageSize?: number; activityId?: string; memberId?: string }): Promise<PageResult<PointRecordVo>> =>
    request.get<PageResult<PointRecordVo>>('/activities/points', { params }),
};

export type {
  ActivityCategoryVo,
  ActivityVo,
  CheckinTokenVo,
  CheckinVo,
  LeaveVo,
  PointRecordVo,
  RegistrationVo,
};
