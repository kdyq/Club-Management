/** 用户（自然人）相关枚举。user 是跨社团的，member 才是社团内身份。 */

export const UserStatus = {
  /** 正常 */
  NORMAL: 1,
  /** 禁用 */
  DISABLED: 2,
  /** 待审核 */
  PENDING: 3,
} as const;
export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus];

export const USER_STATUS_LABEL: Record<UserStatus, string> = {
  [UserStatus.NORMAL]: '正常',
  [UserStatus.DISABLED]: '禁用',
  [UserStatus.PENDING]: '待审核',
};

/** 用户注册来源 */
export const RegisterSource = {
  /** 管理员录入 */
  ADMIN: 1,
  /** 自助注册 */
  SELF: 2,
} as const;
export type RegisterSource = (typeof RegisterSource)[keyof typeof RegisterSource];

export const REGISTER_SOURCE_LABEL: Record<RegisterSource, string> = {
  [RegisterSource.ADMIN]: '管理员录入',
  [RegisterSource.SELF]: '自助注册',
};

/** 性别，0 表示未填 */
export const Gender = {
  UNKNOWN: 0,
  MALE: 1,
  FEMALE: 2,
} as const;
export type Gender = (typeof Gender)[keyof typeof Gender];

export const GENDER_LABEL: Record<Gender, string> = {
  [Gender.UNKNOWN]: '未填',
  [Gender.MALE]: '男',
  [Gender.FEMALE]: '女',
};
