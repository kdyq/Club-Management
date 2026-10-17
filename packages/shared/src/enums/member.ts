/**
 * 成员相关枚举。数据库里存 Int，取值的唯一真相在这里，前后端 import 同一份。
 */

export const MemberStatus = {
  /** 在册 */
  ACTIVE: 1,
  /** 退会 */
  LEFT: 2,
  /** 毕业 */
  GRADUATED: 3,
  /** 冻结 */
  FROZEN: 4,
} as const;
export type MemberStatus = (typeof MemberStatus)[keyof typeof MemberStatus];

export const MEMBER_STATUS_LABEL: Record<MemberStatus, string> = {
  [MemberStatus.ACTIVE]: '在册',
  [MemberStatus.LEFT]: '退会',
  [MemberStatus.GRADUATED]: '毕业',
  [MemberStatus.FROZEN]: '冻结',
};

export const MemberPosition = {
  /** 社长 */
  PRESIDENT: 1,
  /** 副社长 */
  VICE_PRESIDENT: 2,
  /** 部长 */
  DIRECTOR: 3,
  /** 副部长 */
  VICE_DIRECTOR: 4,
  /** 干事 */
  OFFICER: 5,
  /** 普通成员 */
  MEMBER: 6,
} as const;
export type MemberPosition = (typeof MemberPosition)[keyof typeof MemberPosition];

export const MEMBER_POSITION_LABEL: Record<MemberPosition, string> = {
  [MemberPosition.PRESIDENT]: '社长',
  [MemberPosition.VICE_PRESIDENT]: '副社长',
  [MemberPosition.DIRECTOR]: '部长',
  [MemberPosition.VICE_DIRECTOR]: '副部长',
  [MemberPosition.OFFICER]: '干事',
  [MemberPosition.MEMBER]: '普通成员',
};

/** 会长层（社长 / 副社长），用于「负责人」类判断 */
export const LEADERSHIP_POSITIONS: readonly MemberPosition[] = [
  MemberPosition.PRESIDENT,
  MemberPosition.VICE_PRESIDENT,
];
