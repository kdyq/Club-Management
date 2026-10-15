/**
 * 错误码。五位数字：前三位对应 HTTP 状态码，后两位是该类下的序号（开发文档 7.3 节）。
 *
 * 前后端共用：后端抛错时用它，前端拦截器按它做分支处理。
 */

export const ErrorCode = {
  // ---- 400xx 参数校验失败、业务规则不满足 ----
  PARAM_INVALID: 40001,
  BUSINESS_RULE_VIOLATED: 40002,
  FILE_TYPE_NOT_ALLOWED: 40003,
  FILE_TOO_LARGE: 40004,
  UPLOAD_FAILED: 40005,
  CAPTCHA_INVALID: 40006,
  EXCEL_CONTENT_INVALID: 40007,

  // ---- 401xx 未登录、Token 过期、密码错误 ----
  UNAUTHORIZED: 40101,
  TOKEN_EXPIRED: 40102,
  TOKEN_INVALID: 40103,
  BAD_CREDENTIALS: 40104,
  ACCOUNT_DISABLED: 40105,
  ACCOUNT_LOCKED: 40106,
  REFRESH_TOKEN_MISSING: 40107,
  MEMBER_PROFILE_MISSING: 40108,

  // ---- 403xx 已登录但无权限、数据范围外 ----
  FORBIDDEN: 40301,
  OUT_OF_DATA_SCOPE: 40302,
  ROLE_NOT_ASSIGNABLE: 40303,

  // ---- 404xx 资源不存在 ----
  NOT_FOUND: 40401,
  CLUB_NOT_FOUND: 40402,
  MEMBER_NOT_FOUND: 40403,

  // ---- 409xx 冲突 ----
  DUPLICATE_RECORD: 40901,
  STATE_NOT_ALLOWED: 40902,
  CONCURRENT_MODIFIED: 40903,
  ALREADY_REGISTERED: 40904,
  ALREADY_CHECKED_IN: 40905,
  ALREADY_VOTED: 40906,
  ACTIVITY_FULL: 40907,
  VENUE_TIME_CONFLICT: 40908,
  TERM_ARCHIVED: 40909,
  TRANSACTION_VOIDED: 40910,

  // ---- 500xx 服务器内部错误 ----
  INTERNAL_ERROR: 50001,
  DATABASE_ERROR: 50002,
  STORAGE_ERROR: 50003,
  CACHE_ERROR: 50004,
} as const;
export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

/** 默认中文提示。业务需要更具体的说法时，抛错处自己传 message 覆盖。 */
export const ERROR_MESSAGE: Record<ErrorCode, string> = {
  [ErrorCode.PARAM_INVALID]: '请求参数不合法',
  [ErrorCode.BUSINESS_RULE_VIOLATED]: '不满足业务规则',
  [ErrorCode.FILE_TYPE_NOT_ALLOWED]: '不支持的文件类型',
  [ErrorCode.FILE_TOO_LARGE]: '文件超出大小限制',
  [ErrorCode.UPLOAD_FAILED]: '文件上传失败',
  [ErrorCode.CAPTCHA_INVALID]: '验证码错误或已过期',
  [ErrorCode.EXCEL_CONTENT_INVALID]: 'Excel 内容不符合模板要求',

  [ErrorCode.UNAUTHORIZED]: '请先登录',
  [ErrorCode.TOKEN_EXPIRED]: '登录已过期，请重新登录',
  [ErrorCode.TOKEN_INVALID]: '登录凭证无效',
  [ErrorCode.BAD_CREDENTIALS]: '用户名或密码错误',
  [ErrorCode.ACCOUNT_DISABLED]: '账号已被禁用',
  [ErrorCode.ACCOUNT_LOCKED]: '失败次数过多，账号已临时锁定',
  [ErrorCode.REFRESH_TOKEN_MISSING]: '缺少续期凭证，请重新登录',
  [ErrorCode.MEMBER_PROFILE_MISSING]: '当前用户没有社团成员身份',

  [ErrorCode.FORBIDDEN]: '没有该操作的权限',
  [ErrorCode.OUT_OF_DATA_SCOPE]: '超出了你的数据权限范围',
  [ErrorCode.ROLE_NOT_ASSIGNABLE]: '该角色不能被当前用户分配',

  [ErrorCode.NOT_FOUND]: '资源不存在',
  [ErrorCode.CLUB_NOT_FOUND]: '社团不存在',
  [ErrorCode.MEMBER_NOT_FOUND]: '成员不存在',

  [ErrorCode.DUPLICATE_RECORD]: '记录已存在，请勿重复提交',
  [ErrorCode.STATE_NOT_ALLOWED]: '当前状态不允许该操作',
  [ErrorCode.CONCURRENT_MODIFIED]: '数据已被他人修改，请刷新后重试',
  [ErrorCode.ALREADY_REGISTERED]: '你已经报名过该活动',
  [ErrorCode.ALREADY_CHECKED_IN]: '你已经签到过了',
  [ErrorCode.ALREADY_VOTED]: '你已经投过票了',
  [ErrorCode.ACTIVITY_FULL]: '活动报名名额已满',
  [ErrorCode.VENUE_TIME_CONFLICT]: '该时段场地已被占用',
  [ErrorCode.TERM_ARCHIVED]: '届次已归档，不能修改',
  [ErrorCode.TRANSACTION_VOIDED]: '该流水已作废，不能重复操作',

  [ErrorCode.INTERNAL_ERROR]: '服务器内部错误',
  [ErrorCode.DATABASE_ERROR]: '数据库操作失败',
  [ErrorCode.STORAGE_ERROR]: '存储服务异常',
  [ErrorCode.CACHE_ERROR]: '缓存服务异常',
};

/** 取错误码对应的默认文案 */
export function messageOf(code: ErrorCode): string {
  return ERROR_MESSAGE[code] ?? '未知错误';
}

/** 由错误码推出 HTTP 状态码：五位码的前三位就是状态码 */
export function httpStatusOf(code: number): number {
  const status = Math.floor(code / 100);
  return status >= 400 && status < 600 ? status : 500;
}
