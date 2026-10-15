/**
 * 通知与公告枚举。
 *
 * 本项目**只做站内信**（2026-10-15 确认）：邮件、企业微信、钉钉的值保留在枚举里
 * 以便将来接入，但当前不实现对应发送逻辑，`MessageChannelConfig` 表也不会有数据。
 */

export const NotificationType = {
  /** 系统 */
  SYSTEM: 1,
  /** 活动 */
  ACTIVITY: 2,
  /** 审批 */
  APPROVAL: 3,
  /** 财务 */
  FINANCE: 4,
  /** 值班 */
  DUTY: 5,
  /** 公告 */
  ANNOUNCEMENT: 6,
} as const;
export type NotificationType = (typeof NotificationType)[keyof typeof NotificationType];

export const NOTIFICATION_TYPE_LABEL: Record<NotificationType, string> = {
  [NotificationType.SYSTEM]: '系统',
  [NotificationType.ACTIVITY]: '活动',
  [NotificationType.APPROVAL]: '审批',
  [NotificationType.FINANCE]: '财务',
  [NotificationType.DUTY]: '值班',
  [NotificationType.ANNOUNCEMENT]: '公告',
};

export const NotifyChannel = {
  /** 站内信（唯一实现的渠道） */
  INBOX: 1,
  /** 邮件（保留，未实现） */
  EMAIL: 2,
  /** 企业微信（保留，未实现） */
  WECOM: 3,
  /** 钉钉（保留，未实现） */
  DINGTALK: 4,
  /** 短信（保留，未实现） */
  SMS: 5,
} as const;
export type NotifyChannel = (typeof NotifyChannel)[keyof typeof NotifyChannel];

export const NOTIFY_CHANNEL_LABEL: Record<NotifyChannel, string> = {
  [NotifyChannel.INBOX]: '站内信',
  [NotifyChannel.EMAIL]: '邮件',
  [NotifyChannel.WECOM]: '企业微信',
  [NotifyChannel.DINGTALK]: '钉钉',
  [NotifyChannel.SMS]: '短信',
};

/** 当前实际实现的发送渠道。新增渠道时改这里，业务代码不写死 1。 */
export const IMPLEMENTED_NOTIFY_CHANNELS: readonly NotifyChannel[] = [NotifyChannel.INBOX];

export const AnnouncementStatus = {
  /** 草稿 */
  DRAFT: 1,
  /** 已发布 */
  PUBLISHED: 2,
  /** 已下架 */
  OFFLINE: 3,
} as const;
export type AnnouncementStatus = (typeof AnnouncementStatus)[keyof typeof AnnouncementStatus];

export const ANNOUNCEMENT_STATUS_LABEL: Record<AnnouncementStatus, string> = {
  [AnnouncementStatus.DRAFT]: '草稿',
  [AnnouncementStatus.PUBLISHED]: '已发布',
  [AnnouncementStatus.OFFLINE]: '已下架',
};
