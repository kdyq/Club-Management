/** 认证相关常量。集中在这里，避免 cookie 名与锁定策略散落在各处。 */

/** refresh token 的 cookie 名 */
export const REFRESH_COOKIE = 'club_refresh_token';

/** refresh cookie 的路径：只有 /api/auth 下的接口能看到它，减少暴露面 */
export const REFRESH_COOKIE_PATH = '/api/auth';

/** 登录失败多少次后锁定 */
export const LOGIN_MAX_FAILURES = 5;

/** 锁定窗口（秒）。计数与锁定共用一个键，TTL 到期即解锁。 */
export const LOGIN_LOCK_SECONDS = 10 * 60;

/** 验证码有效期（秒） */
export const CAPTCHA_TTL_SECONDS = 5 * 60;

/** 验证码位数 */
export const CAPTCHA_LENGTH = 4;

/** 登出后把 refresh 的 jti 拉黑，直到它自然过期 */
export const REFRESH_BLACKLIST_PREFIX = 'auth:refresh:blacklist:';

export const LOGIN_FAIL_PREFIX = 'auth:login:fail:';
export const CAPTCHA_PREFIX = 'auth:captcha:';
