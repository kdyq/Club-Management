import type { MemberQuery, MemberVo, PageResult } from '@club/shared';
import { request } from './http';

export const memberApi = {
  page: (params: MemberQuery): Promise<PageResult<MemberVo>> =>
    request.get<PageResult<MemberVo>>('/members', { params }),
};
