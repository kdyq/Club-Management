import type { OverviewVo, PublicOverviewVo } from '@club/shared';
import { request } from './http';

export const statsApi = {
  /** 登录页用，无需登录 */
  public: (): Promise<PublicOverviewVo> =>
    request.get<PublicOverviewVo>('/stats/public', { silent: true }),

  overview: (): Promise<OverviewVo> => request.get<OverviewVo>('/stats/overview'),
};

export type { OverviewVo, PublicOverviewVo };
