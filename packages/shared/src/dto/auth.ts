/** 认证相关的响应类型，前后端共用。 */

export interface ProfileRoleVo {
  id: string;
  code: string;
  name: string;
}

/**
 * 当前登录者资料。id 一律是字符串：数据库主键是 BIGINT UNSIGNED，
 * 超过 Number.MAX_SAFE_INTEGER，序列化成 number 会丢精度。
 */
export interface ProfileVo {
  userId: string;
  username: string;
  realName: string;
  avatarUrl: string | null;
  memberId: string;
  memberNo: string | null;
  position: number;
  positionLabel: string;
  deptId: string | null;
  deptName: string | null;
  clubId: string;
  clubName: string;
  clubShortName: string | null;
  termId: string;
  termName: string;
  roles: ProfileRoleVo[];
  /** 功能权限码清单，前端用它做菜单与按钮的显隐 */
  permissions: string[];
  /** 多角色取并集后的最大数据范围，见 DataScope */
  maxDataScope: number;
}

export interface LoginVo {
  accessToken: string;
  expiresIn: number;
  profile: ProfileVo;
}

export interface CaptchaVo {
  captchaId: string;
  enabled: boolean;
}

export interface RefreshVo {
  accessToken: string;
  expiresIn: number;
  profile: ProfileVo;
}
