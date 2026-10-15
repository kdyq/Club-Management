import type {
  AnnouncementVo,
  AssetBorrowVo,
  AssetVo,
  DutyPlanVo,
  DutyScheduleVo,
  NotificationInboxVo,
  VenueBookingVo,
  VenueVo,
} from '@club/shared';
import type { DashboardVo } from '@club/shared';
import { request } from './http';

interface Paged<T> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
}

export const statsApi2 = {
  dashboard: (): Promise<DashboardVo> => request.get<DashboardVo>('/stats/dashboard'),
};

export const noticeApi = {
  inbox: (params: { onlyUnread?: boolean; page?: number; pageSize?: number } = {}): Promise<NotificationInboxVo> =>
    request.get<NotificationInboxVo>('/notifications', { params }),
  markRead: (id: string): Promise<null> => request.post<null>(`/notifications/${id}/read`, {}),
  markAllRead: (): Promise<{ count: number }> => request.post('/notifications/read-all', {}),
};

export const announcementApi = {
  page: (params: Record<string, unknown>): Promise<Paged<AnnouncementVo>> =>
    request.get<Paged<AnnouncementVo>>('/announcements', { params }),
  detail: (id: string): Promise<AnnouncementVo> => request.get<AnnouncementVo>(`/announcements/${id}`),
  create: (data: {
    title: string;
    content: string;
    type?: number;
    isTop?: boolean;
    publishNow?: boolean;
  }): Promise<AnnouncementVo> => request.post<AnnouncementVo>('/announcements', data),
  publish: (id: string): Promise<AnnouncementVo> => request.post<AnnouncementVo>(`/announcements/${id}/publish`, {}),
  offline: (id: string): Promise<AnnouncementVo> => request.post<AnnouncementVo>(`/announcements/${id}/offline`, {}),
};

export const assetApi = {
  page: (params: Record<string, unknown>): Promise<{ list: AssetVo[]; total: number }> =>
    request.get('/assets', { params }),
  create: (data: Record<string, unknown>): Promise<AssetVo> => request.post<AssetVo>('/assets', data),
  borrows: (params: Record<string, unknown>): Promise<Paged<AssetBorrowVo>> =>
    request.get<Paged<AssetBorrowVo>>('/assets/borrows', { params }),
  borrow: (data: { assetId: string; qty: number; expectReturnTime?: string; remark?: string }): Promise<AssetBorrowVo> =>
    request.post<AssetBorrowVo>('/assets/borrows', data),
  returnAsset: (id: string): Promise<AssetBorrowVo> =>
    request.post<AssetBorrowVo>(`/assets/borrows/${id}/return`, {}),
};

export const venueApi = {
  page: (params: Record<string, unknown> = {}): Promise<{ list: VenueVo[]; total: number }> =>
    request.get('/venues', { params }),
  create: (data: Record<string, unknown>): Promise<VenueVo> => request.post<VenueVo>('/venues', data),
  bookings: (params: Record<string, unknown>): Promise<Paged<VenueBookingVo>> =>
    request.get<Paged<VenueBookingVo>>('/venues/bookings', { params }),
  book: (data: {
    venueId: string;
    bookDate: string;
    startTime: string;
    endTime: string;
    purpose?: string;
  }): Promise<VenueBookingVo> => request.post<VenueBookingVo>('/venues/bookings', data),
  audit: (id: string, approved: boolean): Promise<VenueBookingVo> =>
    request.post<VenueBookingVo>(`/venues/bookings/${id}/audit`, { approved }),
  cancel: (id: string): Promise<null> => request.post<null>(`/venues/bookings/${id}/cancel`, {}),
};

export const dutyApi = {
  plans: (): Promise<DutyPlanVo[]> => request.get<DutyPlanVo[]>('/duty/plans'),
  createPlan: (data: { name: string; startDate: string; endDate: string }): Promise<DutyPlanVo> =>
    request.post<DutyPlanVo>('/duty/plans', data),
  publishPlan: (id: string): Promise<DutyPlanVo> => request.post<DutyPlanVo>(`/duty/plans/${id}/publish`, {}),
  schedules: (params: Record<string, unknown>): Promise<Paged<DutyScheduleVo>> =>
    request.get<Paged<DutyScheduleVo>>('/duty/schedules', { params }),
  createSchedule: (data: {
    planId: string;
    dutyDate: string;
    startTime: string;
    endTime: string;
    location?: string;
    memberId: string;
  }): Promise<DutyScheduleVo> => request.post<DutyScheduleVo>('/duty/schedules', data),
  confirm: (id: string): Promise<DutyScheduleVo> => request.post<DutyScheduleVo>(`/duty/schedules/${id}/confirm`, {}),
  writeLog: (id: string, data: { content: string; handoverContent?: string }): Promise<{ logId: string }> =>
    request.post(`/duty/schedules/${id}/log`, data),
  markAbsent: (id: string): Promise<DutyScheduleVo> =>
    request.post<DutyScheduleVo>(`/duty/schedules/${id}/absent`, {}),
};

export type {
  AnnouncementVo,
  AssetBorrowVo,
  AssetVo,
  DashboardVo,
  DutyPlanVo,
  DutyScheduleVo,
  VenueBookingVo,
  VenueVo,
};
