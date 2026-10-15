import type { CaptchaVo, LoginVo, ProfileVo, RefreshVo } from '@club/shared';
import { request } from './http';

export interface LoginPayload {
  username: string;
  password: string;
  captchaId?: string;
  captchaCode?: string;
}

export const authApi = {
  captcha: (): Promise<CaptchaVo> => request.get<CaptchaVo>('/auth/captcha', { silent: true }),

  login: (payload: LoginPayload): Promise<LoginVo> =>
    // 登录失败的提示由登录页自己渲染在表单里，不要弹全局 toast
    request.post<LoginVo>('/auth/login', payload, { silent: true }),

  refresh: (): Promise<RefreshVo> => request.post<RefreshVo>('/auth/refresh', {}, { silent: true }),

  logout: (): Promise<null> => request.post<null>('/auth/logout', {}, { silent: true }),

  profile: (): Promise<ProfileVo> => request.get<ProfileVo>('/auth/profile'),
};

export type { CaptchaVo, LoginVo, ProfileVo, RefreshVo };
