/** 日常运营与物资场地枚举：值班、物资借还、场地预约、招新申请。 */

export const DutyStatus = {
  /** 待确认 */
  PENDING: 1,
  /** 已确认 */
  CONFIRMED: 2,
  /** 已换班 */
  SWAPPED: 3,
  /** 已完成 */
  FINISHED: 4,
  /** 缺勤 */
  ABSENT: 5,
} as const;
export type DutyStatus = (typeof DutyStatus)[keyof typeof DutyStatus];

export const DUTY_STATUS_LABEL: Record<DutyStatus, string> = {
  [DutyStatus.PENDING]: '待确认',
  [DutyStatus.CONFIRMED]: '已确认',
  [DutyStatus.SWAPPED]: '已换班',
  [DutyStatus.FINISHED]: '已完成',
  [DutyStatus.ABSENT]: '缺勤',
};

export const AssetBorrowStatus = {
  /** 申请中 */
  APPLYING: 1,
  /** 已借出 */
  BORROWED: 2,
  /** 已归还 */
  RETURNED: 3,
  /** 逾期 */
  OVERDUE: 4,
  /** 损坏 */
  DAMAGED: 5,
} as const;
export type AssetBorrowStatus = (typeof AssetBorrowStatus)[keyof typeof AssetBorrowStatus];

export const ASSET_BORROW_STATUS_LABEL: Record<AssetBorrowStatus, string> = {
  [AssetBorrowStatus.APPLYING]: '申请中',
  [AssetBorrowStatus.BORROWED]: '已借出',
  [AssetBorrowStatus.RETURNED]: '已归还',
  [AssetBorrowStatus.OVERDUE]: '逾期',
  [AssetBorrowStatus.DAMAGED]: '损坏',
};

/** 处于「占用中」的借还状态，用于计算 asset.availableQty */
export const ACTIVE_BORROW_STATUSES: readonly AssetBorrowStatus[] = [
  AssetBorrowStatus.APPLYING,
  AssetBorrowStatus.BORROWED,
  AssetBorrowStatus.OVERDUE,
];

export const BookingStatus = {
  /** 待审批 */
  PENDING: 1,
  /** 已通过 */
  APPROVED: 2,
  /** 已驳回 */
  REJECTED: 3,
  /** 已取消 */
  CANCELLED: 4,
} as const;
export type BookingStatus = (typeof BookingStatus)[keyof typeof BookingStatus];

export const BOOKING_STATUS_LABEL: Record<BookingStatus, string> = {
  [BookingStatus.PENDING]: '待审批',
  [BookingStatus.APPROVED]: '已通过',
  [BookingStatus.REJECTED]: '已驳回',
  [BookingStatus.CANCELLED]: '已取消',
};

/** 占用场地时段的状态：通过后即占用，取消/驳回则释放 */
export const BLOCKING_BOOKING_STATUSES: readonly BookingStatus[] = [
  BookingStatus.PENDING,
  BookingStatus.APPROVED,
];

export const ApplicationStatus = {
  /** 待审核 */
  PENDING: 1,
  /** 初筛通过 */
  SCREENED: 2,
  /** 面试中 */
  INTERVIEWING: 3,
  /** 已录取 */
  ADMITTED: 4,
  /** 未录取 */
  REJECTED: 5,
  /** 已放弃 */
  WITHDRAWN: 6,
} as const;
export type ApplicationStatus = (typeof ApplicationStatus)[keyof typeof ApplicationStatus];

export const APPLICATION_STATUS_LABEL: Record<ApplicationStatus, string> = {
  [ApplicationStatus.PENDING]: '待审核',
  [ApplicationStatus.SCREENED]: '初筛通过',
  [ApplicationStatus.INTERVIEWING]: '面试中',
  [ApplicationStatus.ADMITTED]: '已录取',
  [ApplicationStatus.REJECTED]: '未录取',
  [ApplicationStatus.WITHDRAWN]: '已放弃',
};

/** 文件可见范围 */
export const FileScope = {
  PUBLIC: 1,
  MEMBER: 2,
  DEPT: 3,
  ROLE: 4,
  PRIVATE: 5,
} as const;
export type FileScope = (typeof FileScope)[keyof typeof FileScope];

export const FILE_SCOPE_LABEL: Record<FileScope, string> = {
  [FileScope.PUBLIC]: '公开',
  [FileScope.MEMBER]: '成员可见',
  [FileScope.DEPT]: '部门可见',
  [FileScope.ROLE]: '角色可见',
  [FileScope.PRIVATE]: '私有',
};

/** 文件存储方式。预留切换对象存储的开关。 */
export const StorageType = {
  LOCAL: 1,
  OSS: 2,
} as const;
export type StorageType = (typeof StorageType)[keyof typeof StorageType];

export const STORAGE_TYPE_LABEL: Record<StorageType, string> = {
  [StorageType.LOCAL]: '本地磁盘',
  [StorageType.OSS]: '对象存储',
};

/** 积分流水方向 */
export const PointType = {
  /** 获得 */
  EARN: 1,
  /** 扣减 */
  DEDUCT: 2,
} as const;
export type PointType = (typeof PointType)[keyof typeof PointType];

export const POINT_TYPE_LABEL: Record<PointType, string> = {
  [PointType.EARN]: '获得',
  [PointType.DEDUCT]: '扣减',
};
