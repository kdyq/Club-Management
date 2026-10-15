/** RBAC 与数据范围枚举。 */

/**
 * 数据范围。多角色时取最大范围（并集）。
 * 第二层权限，只做功能权限不做数据范围是最常见的越权来源。
 */
export const DataScope = {
  /** 仅本人 */
  SELF: 1,
  /** 本部门 */
  DEPT: 2,
  /** 本部门及以下 */
  DEPT_AND_BELOW: 3,
  /** 本社团 */
  CLUB: 4,
  /** 全部 */
  ALL: 5,
} as const;
export type DataScope = (typeof DataScope)[keyof typeof DataScope];

export const DATA_SCOPE_LABEL: Record<DataScope, string> = {
  [DataScope.SELF]: '仅本人',
  [DataScope.DEPT]: '本部门',
  [DataScope.DEPT_AND_BELOW]: '本部门及以下',
  [DataScope.CLUB]: '本社团',
  [DataScope.ALL]: '全部',
};

/** 权限节点类型。permission 表同时承担菜单树职责。 */
export const PermissionType = {
  /** 目录 */
  DIRECTORY: 1,
  /** 菜单 */
  MENU: 2,
  /** 按钮与接口 */
  ACTION: 3,
} as const;
export type PermissionType = (typeof PermissionType)[keyof typeof PermissionType];

export const PERMISSION_TYPE_LABEL: Record<PermissionType, string> = {
  [PermissionType.DIRECTORY]: '目录',
  [PermissionType.MENU]: '菜单',
  [PermissionType.ACTION]: '按钮·接口',
};

/** 社团状态 */
export const ClubStatus = {
  NORMAL: 1,
  DISABLED: 2,
} as const;
export type ClubStatus = (typeof ClubStatus)[keyof typeof ClubStatus];

/** 届次状态 */
export const TermStatus = {
  /** 进行中 */
  ACTIVE: 1,
  /** 已归档 */
  ARCHIVED: 2,
} as const;
export type TermStatus = (typeof TermStatus)[keyof typeof TermStatus];

export const TERM_STATUS_LABEL: Record<TermStatus, string> = {
  [TermStatus.ACTIVE]: '进行中',
  [TermStatus.ARCHIVED]: '已归档',
};

/** 通用启用状态 */
export const EnableStatus = {
  ENABLED: 1,
  DISABLED: 2,
} as const;
export type EnableStatus = (typeof EnableStatus)[keyof typeof EnableStatus];

export const ENABLE_STATUS_LABEL: Record<EnableStatus, string> = {
  [EnableStatus.ENABLED]: '正常',
  [EnableStatus.DISABLED]: '停用',
};
