/** 活动链路枚举：活动、报名、签到、请假。 */

export const ActivityStatus = {
  /** 草稿 */
  DRAFT: 1,
  /** 待审批 */
  PENDING_APPROVAL: 2,
  /** 报名中 */
  REGISTERING: 3,
  /** 报名结束 */
  REGISTRATION_CLOSED: 4,
  /** 进行中 */
  ONGOING: 5,
  /** 已结束 */
  FINISHED: 6,
  /** 已取消 */
  CANCELLED: 7,
} as const;
export type ActivityStatus = (typeof ActivityStatus)[keyof typeof ActivityStatus];

export const ACTIVITY_STATUS_LABEL: Record<ActivityStatus, string> = {
  [ActivityStatus.DRAFT]: '草稿',
  [ActivityStatus.PENDING_APPROVAL]: '待审批',
  [ActivityStatus.REGISTERING]: '报名中',
  [ActivityStatus.REGISTRATION_CLOSED]: '报名结束',
  [ActivityStatus.ONGOING]: '进行中',
  [ActivityStatus.FINISHED]: '已结束',
  [ActivityStatus.CANCELLED]: '已取消',
};

export const RegistrationStatus = {
  /** 待审核 */
  PENDING: 1,
  /** 已通过 */
  APPROVED: 2,
  /** 已拒绝 */
  REJECTED: 3,
  /** 已取消 */
  CANCELLED: 4,
} as const;
export type RegistrationStatus = (typeof RegistrationStatus)[keyof typeof RegistrationStatus];

export const REGISTRATION_STATUS_LABEL: Record<RegistrationStatus, string> = {
  [RegistrationStatus.PENDING]: '待审核',
  [RegistrationStatus.APPROVED]: '已通过',
  [RegistrationStatus.REJECTED]: '已拒绝',
  [RegistrationStatus.CANCELLED]: '已取消',
};

export const CheckinType = {
  /** 动态二维码 */
  QRCODE: 1,
  /** 数字口令 */
  CODE: 2,
  /** 位置围栏 */
  GEOFENCE: 3,
  /** 管理员代签 */
  ADMIN: 4,
} as const;
export type CheckinType = (typeof CheckinType)[keyof typeof CheckinType];

export const CHECKIN_TYPE_LABEL: Record<CheckinType, string> = {
  [CheckinType.QRCODE]: '动态二维码',
  [CheckinType.CODE]: '数字口令',
  [CheckinType.GEOFENCE]: '位置围栏',
  [CheckinType.ADMIN]: '管理员代签',
};

export const CheckinStatus = {
  /** 正常 */
  NORMAL: 1,
  /** 迟到 */
  LATE: 2,
  /** 早退 */
  EARLY_LEAVE: 3,
  /** 缺勤 */
  ABSENT: 4,
} as const;
export type CheckinStatus = (typeof CheckinStatus)[keyof typeof CheckinStatus];

export const CHECKIN_STATUS_LABEL: Record<CheckinStatus, string> = {
  [CheckinStatus.NORMAL]: '正常',
  [CheckinStatus.LATE]: '迟到',
  [CheckinStatus.EARLY_LEAVE]: '早退',
  [CheckinStatus.ABSENT]: '缺勤',
};

export const LeaveStatus = {
  /** 待审批 */
  PENDING: 1,
  /** 已批准 */
  APPROVED: 2,
  /** 已驳回 */
  REJECTED: 3,
} as const;
export type LeaveStatus = (typeof LeaveStatus)[keyof typeof LeaveStatus];

export const LEAVE_STATUS_LABEL: Record<LeaveStatus, string> = {
  [LeaveStatus.PENDING]: '待审批',
  [LeaveStatus.APPROVED]: '已批准',
  [LeaveStatus.REJECTED]: '已驳回',
};
