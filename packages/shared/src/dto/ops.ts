/** 场地与预约的共享类型。 */
import type { PageQuery } from '../types/api.js';

export interface VenueVo {
  id: string;
  name: string;
  location: string | null;
  capacity: number;
  openWeekdays: string | null;
  openTime: string | null;
  closeTime: string | null;
  status: number;
  bookingCount: number;
}

export interface VenueBookingVo {
  id: string;
  venueId: string;
  venueName: string;
  activityId: string | null;
  memberId: string;
  memberName: string;
  bookDate: string;
  startTime: string;
  endTime: string;
  purpose: string | null;
  status: number;
  statusLabel: string;
  approverName: string | null;
}

export interface VenueQuery extends PageQuery {
  keyword?: string;
}

export interface BookingQuery extends PageQuery {
  venueId?: string;
  status?: number;
  dateFrom?: string;
  dateTo?: string;
}

export interface CreateBookingDto {
  venueId: string;
  bookDate: string;
  startTime: string;
  endTime: string;
  purpose?: string;
  activityId?: string | null;
}

/** 物资 */
export interface AssetVo {
  id: string;
  code: string | null;
  name: string;
  category: string | null;
  spec: string | null;
  unit: string | null;
  totalQty: number;
  availableQty: number;
  location: string | null;
  keeperName: string | null;
  status: number;
  /** 在借数量 = 总数 - 可借，直接给出便于列表展示 */
  borrowedQty: number;
}

export interface AssetBorrowVo {
  id: string;
  assetId: string;
  assetName: string;
  memberId: string;
  memberName: string;
  qty: number;
  borrowTime: string;
  expectReturnTime: string | null;
  actualReturnTime: string | null;
  status: number;
  statusLabel: string;
  remark: string | null;
}

export interface AssetQuery extends PageQuery {
  keyword?: string;
  category?: string;
}

export interface BorrowQuery extends PageQuery {
  assetId?: string;
  memberId?: string;
  status?: number;
}

export interface CreateAssetDto {
  name: string;
  code?: string;
  category?: string;
  spec?: string;
  unit?: string;
  totalQty?: number;
  location?: string;
  keeperMemberId?: string | null;
}

export interface BorrowAssetDto {
  assetId: string;
  qty: number;
  expectReturnTime?: string;
  remark?: string;
}

/** 值班 */
export interface DutyPlanVo {
  id: string;
  name: string;
  termId: string;
  termName: string;
  startDate: string;
  endDate: string;
  publishStatus: number;
  publishStatusLabel: string;
  scheduleCount: number;
}

export interface DutyScheduleVo {
  id: string;
  planId: string;
  planName: string;
  dutyDate: string;
  weekday: number;
  weekdayLabel: string;
  startTime: string;
  endTime: string;
  location: string | null;
  memberId: string;
  memberName: string;
  deptName: string | null;
  status: number;
  statusLabel: string;
  checkinTime: string | null;
  actualMinutes: number | null;
  logCount: number;
}

export interface DutyQuery extends PageQuery {
  planId?: string;
  memberId?: string;
  status?: number;
  dateFrom?: string;
  dateTo?: string;
}

export interface CreateDutyPlanDto {
  name: string;
  startDate: string;
  endDate: string;
}

export interface CreateDutyScheduleDto {
  planId: string;
  dutyDate: string;
  startTime: string;
  endTime: string;
  location?: string;
  memberId: string;
}

export interface WriteDutyLogDto {
  content: string;
  handoverContent?: string;
}

/** 公告 */
export interface AnnouncementVo {
  id: string;
  title: string;
  content: string;
  type: number;
  typeLabel: string;
  isTop: boolean;
  publishStatus: number;
  publishStatusLabel: string;
  publishAt: string | null;
  publisherName: string | null;
  viewCount: number;
  createdAt: string;
}

export interface AnnouncementQuery extends PageQuery {
  keyword?: string;
  type?: number;
  publishStatus?: number;
}

export interface CreateAnnouncementDto {
  title: string;
  content: string;
  type?: number;
  isTop?: boolean;
  /** 直接发布还是存草稿 */
  publishNow?: boolean;
}
