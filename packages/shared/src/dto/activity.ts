/** 活动链路的请求与响应类型，前后端共用。 */

export interface ActivityCategoryVo {
  id: string;
  name: string;
  color: string | null;
  sort: number;
  status: number;
  activityCount: number;
}

export interface ActivityVo {
  id: string;
  title: string;
  summary: string | null;
  content: string | null;
  location: string | null;
  coverUrl: string | null;
  categoryId: string | null;
  categoryName: string | null;
  termId: string | null;
  startTime: string;
  endTime: string;
  signupStart: string | null;
  signupEnd: string | null;
  capacity: number;
  minMembers: number;
  needAudit: boolean;
  organizerMemberId: string | null;
  organizerName: string | null;
  contactInfo: string | null;
  checkinType: number;
  checkinStart: string | null;
  checkinEnd: string | null;
  points: number;
  volunteerHours: string;
  budgetAmount: string;
  actualAmount: string;
  status: number;
  statusLabel: string;
  approvalInstanceId: string | null;
  summaryReport: string | null;
  /** 已通过审核的报名人数，用于报名进度展示 */
  approvedCount: number;
  pendingCount: number;
  checkedInCount: number;
  createdAt: string;
}

export interface ActivityQuery {
  page?: number;
  pageSize?: number;
  keyword?: string;
  categoryId?: string;
  status?: number;
  /** 只看自己组织的 */
  mine?: boolean;
  /** 只看我报名的 */
  joined?: boolean;
}

export interface CreateActivityDto {
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
  minMembers?: number;
  needAudit?: boolean;
  contactInfo?: string;
  checkinType?: number;
  checkinStart?: string;
  checkinEnd?: string;
  points?: number;
  volunteerHours?: number;
  budgetAmount?: number;
}

export interface UpdateActivityDto extends Partial<CreateActivityDto> {
  summaryReport?: string;
}

/** 报名记录 */
export interface RegistrationVo {
  id: string;
  activityId: string;
  activityTitle: string;
  memberId: string | null;
  memberName: string;
  deptName: string | null;
  guestName: string | null;
  guestPhone: string | null;
  applyAt: string;
  status: number;
  statusLabel: string;
  auditRemark: string | null;
  remark: string | null;
  checkedIn: boolean;
  checkinStatus: number | null;
}

export interface RegistrationQuery {
  page?: number;
  pageSize?: number;
  activityId?: string;
  status?: number;
  keyword?: string;
}

/** 签到记录 */
export interface CheckinVo {
  id: string;
  activityId: string;
  memberId: string;
  memberName: string;
  deptName: string | null;
  checkinTime: string | null;
  checkinType: number;
  checkinTypeLabel: string;
  status: number;
  statusLabel: string;
  isMakeup: boolean;
  makeupReason: string | null;
}

/** 签到二维码：内容由服务端按时间片计算，客户端只负责展示 */
export interface CheckinTokenVo {
  token: string;
  /** 当前时间片失效的秒数 */
  expiresIn: number;
  /** 数字口令模式下展示的口令 */
  code: string;
  checkinType: number;
}

export interface LeaveVo {
  id: string;
  activityId: string;
  activityTitle: string;
  memberId: string;
  memberName: string;
  reason: string;
  status: number;
  statusLabel: string;
  auditRemark: string | null;
  createdAt: string;
}

/** 积分流水 */
export interface PointRecordVo {
  id: string;
  memberId: string;
  memberName: string;
  points: number;
  reason: string | null;
  bizType: string | null;
  bizId: string | null;
  occurredAt: string;
}

/** 志愿时长 */
export interface VolunteerHourVo {
  id: string;
  memberId: string;
  memberName: string;
  activityId: string | null;
  activityTitle: string | null;
  hours: string;
  certifyStatus: number;
  certificateNo: string | null;
}
