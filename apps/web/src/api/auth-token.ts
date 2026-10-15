/**
 * access token 的存放处。
 *
 * 单独放一个模块，是为了打破「store 依赖 api、api 又依赖 store」的循环。
 * 按开发文档 7.4 节：access token 只存内存（这里），**不进 localStorage**，
 * 否则 XSS 时会被直接读走。刷新页面后靠 httpOnly Cookie 里的 refresh 换回来。
 */
let token: string | null = null;

export const accessToken = {
  get(): string | null {
    return token;
  },
  set(value: string | null): void {
    token = value;
  },
};

/** 会话彻底失效时（续期也失败）由 http 层回调，交给 store 跳登录页 */
type UnauthorizedHandler = () => void;
let onUnauthorized: UnauthorizedHandler | null = null;

export function setUnauthorizedHandler(handler: UnauthorizedHandler | null): void {
  onUnauthorized = handler;
}

export function notifyUnauthorized(): void {
  onUnauthorized?.();
}
