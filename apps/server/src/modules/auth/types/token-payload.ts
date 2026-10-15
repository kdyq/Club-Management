/** access / refresh token 的载荷。BigInt 不能直接进 JSON，统一转字符串。 */

export interface AccessTokenPayload {
  /** userId */
  sub: string;
  /** memberId */
  mid: string;
  /** clubId */
  cid: string;
  /** termId */
  tid: string;
  /** 区分两种 token，防止拿 refresh 当 access 用 */
  typ: 'access';
}

export interface RefreshTokenPayload {
  /** userId */
  sub: string;
  /** memberId */
  mid: string;
  /** 轮换用的唯一 id，登出时写进黑名单 */
  jti: string;
  typ: 'refresh';
}

export type TokenPayload = AccessTokenPayload | RefreshTokenPayload;
