/**
 * Axios 实例。统一处理三件事（开发文档 8.3 节）：
 * 1. 注入 Authorization
 * 2. 解包响应体的 data 字段 —— 业务代码里不要出现 .data.data
 * 3. 401 时用 refresh token 静默续期一次，失败才跳登录页；续期要加并发锁，
 *    否则多个 401 会同时触发多次续期，把 refresh token 用到失效。
 */
import axios, { AxiosError, type AxiosRequestConfig, type AxiosResponse } from 'axios';
import { ElMessage } from 'element-plus';
import { accessToken, notifyUnauthorized } from './auth-token';

/** 业务错误：带上后端的五位错误码与中文提示 */
export class ApiError extends Error {
  constructor(
    readonly code: number,
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** 请求配置扩展：silent 为 true 时不自动弹提示，由调用方自己处理 */
export interface RequestConfig extends AxiosRequestConfig {
  silent?: boolean;
  /** 内部使用：标记该请求已经重试过一次，避免无限循环 */
  _retried?: boolean;
}

interface ApiEnvelope<T> {
  code: number;
  message: string;
  data: T;
  traceId?: string;
}

const http = axios.create({
  baseURL: '/api',
  timeout: 20000,
  // refresh 走 httpOnly Cookie，必须带上
  withCredentials: true,
});

http.interceptors.request.use((config) => {
  const token = accessToken.get();
  if (token !== null) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/** 续期中的 Promise，作为并发锁：多个 401 共用同一次续期 */
let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise !== null) return refreshPromise;

  refreshPromise = (async (): Promise<string | null> => {
    try {
      // 用裸 axios，避免走本实例的拦截器造成递归
      const response = await axios.post<ApiEnvelope<{ accessToken: string }>>(
        '/api/auth/refresh',
        {},
        { withCredentials: true },
      );
      const next = response.data.data?.accessToken ?? null;
      accessToken.set(next);
      return next;
    } catch {
      accessToken.set(null);
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

/** 主动续期，供路由守卫在刷新页面后调用 */
export async function tryRefreshToken(): Promise<string | null> {
  return refreshAccessToken();
}

const REFRESH_EXEMPT = ['/auth/login', '/auth/refresh', '/auth/captcha'];

http.interceptors.response.use(
  (response: AxiosResponse<ApiEnvelope<unknown>>) => {
    // 解包：业务代码直接拿 data
    return response.data.data as never;
  },
  async (error: AxiosError<ApiEnvelope<unknown>>) => {
    const config = (error.config ?? {}) as RequestConfig;
    const status = error.response?.status ?? 0;
    const body = error.response?.data;
    const url = config.url ?? '';

    // 401：先静默续期一次
    if (status === 401 && config._retried !== true && !REFRESH_EXEMPT.some((p) => url.includes(p))) {
      config._retried = true;
      const next = await refreshAccessToken();
      if (next !== null) {
        return http.request(config);
      }
      accessToken.set(null);
      notifyUnauthorized();
      const expired = new ApiError(body?.code ?? 40101, '登录已过期，请重新登录', 401);
      if (config.silent !== true) ElMessage.error(expired.message);
      return Promise.reject(expired);
    }

    const apiError = new ApiError(
      body?.code ?? status * 100 + 1,
      body?.message ?? error.message ?? '网络异常，请稍后重试',
      status,
    );

    // 401/403 由守卫与页面自己处理，其余统一弹提示，省掉每个调用点的重复代码
    const quiet = config.silent === true || status === 401 || status === 403;
    if (!quiet) {
      ElMessage.error(apiError.message);
    }
    return Promise.reject(apiError);
  },
);

/** 下载：导出接口用，走 blob 并触发浏览器保存 */
export async function download(url: string, params?: Record<string, unknown>, filename?: string): Promise<void> {
  const response = await axios.get(`/api${url}`, {
    params,
    responseType: 'blob',
    withCredentials: true,
    headers: accessToken.get() !== null ? { Authorization: `Bearer ${accessToken.get()}` } : {},
  });

  const disposition = response.headers['content-disposition'] as string | undefined;
  let name = filename ?? '导出.xlsx';
  if (disposition !== undefined) {
    const match = /filename\*?=(?:UTF-8''|")?([^";]+)/i.exec(disposition);
    if (match?.[1] !== undefined) name = decodeURIComponent(match[1].replace(/"/g, ''));
  }

  const blobUrl = URL.createObjectURL(response.data as Blob);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(blobUrl);
}

/** 类型化的快捷方法 */
export const request = {
  get: <T>(url: string, config?: RequestConfig): Promise<T> =>
    http.get(url, config) as unknown as Promise<T>,
  post: <T>(url: string, data?: unknown, config?: RequestConfig): Promise<T> =>
    http.post(url, data, config) as unknown as Promise<T>,
  put: <T>(url: string, data?: unknown, config?: RequestConfig): Promise<T> =>
    http.put(url, data, config) as unknown as Promise<T>,
  delete: <T>(url: string, config?: RequestConfig): Promise<T> =>
    http.delete(url, config) as unknown as Promise<T>,
};

export default http;
