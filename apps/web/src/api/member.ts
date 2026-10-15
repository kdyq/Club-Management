import type {
  DepartmentNodeVo,
  MemberQuery,
  MemberVo,
  PageResult,
} from '@club/shared';
import { download, request } from './http';

/** 成员详情，比列表多几个档案统计 */
export interface MemberDetailVo extends MemberVo {
  joinDateFull: string | null;
  leaveDate: string | null;
  leaveReason: string | null;
  pointRecordCount: number;
  paidFeeCount: number;
  registrationCount: number;
}

export interface CreateMemberPayload {
  realName: string;
  studentNo: string;
  gender?: number;
  grade?: string;
  major?: string;
  className?: string;
  phone?: string;
  email?: string;
  deptId?: string | null;
  position?: number;
  isCore?: boolean;
  roleIds?: string[];
  joinDate?: string;
}

export interface UpdateMemberPayload extends Partial<Omit<CreateMemberPayload, 'studentNo'>> {
  status?: number;
  leaveDate?: string;
  leaveReason?: string;
}

export interface CreateMemberResult {
  member: MemberVo;
  initialPassword: string | null;
  reusedUser: boolean;
}

export interface ImportRowError {
  row: number;
  realName: string;
  reason: string;
}

export interface ImportResult {
  total: number;
  success: number;
  failed: number;
  errors: ImportRowError[];
  initialPassword: string | null;
}

export const memberApi = {
  page: (params: MemberQuery): Promise<PageResult<MemberVo>> =>
    request.get<PageResult<MemberVo>>('/members', { params }),

  detail: (id: string): Promise<MemberDetailVo> => request.get<MemberDetailVo>(`/members/${id}`),

  profile: (): Promise<MemberDetailVo & { account: unknown }> =>
    request.get('/members/me'),

  create: (data: CreateMemberPayload): Promise<CreateMemberResult> =>
    request.post<CreateMemberResult>('/members', data),

  update: (id: string, data: UpdateMemberPayload): Promise<MemberVo> =>
    request.put<MemberVo>(`/members/${id}`, data),

  /** 导出：与列表页同一套筛选条件，后端仍会再叠一层数据范围 */
  export: (params: MemberQuery): Promise<void> =>
    download('/members/export', params as Record<string, unknown>),

  downloadTemplate: (): Promise<void> =>
    download('/members/import-template', {}, '成员导入模板.xlsx'),

  import: async (file: File): Promise<ImportResult> => {
    const form = new FormData();
    form.append('file', file);
    return request.post<ImportResult>('/members/import', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

export const departmentApi = {
  tree: (includeDisabled = false): Promise<DepartmentNodeVo[]> =>
    request.get<DepartmentNodeVo[]>('/departments/tree', { params: { includeDisabled } }),

  options: (): Promise<{ id: string; name: string; parentId: string | null }[]> =>
    request.get('/departments/options'),

  create: (data: {
    name: string;
    parentId?: string | null;
    leaderMemberId?: string | null;
    description?: string;
    sort?: number;
  }): Promise<DepartmentNodeVo> => request.post<DepartmentNodeVo>('/departments', data),

  update: (
    id: string,
    data: {
      name?: string;
      parentId?: string | null;
      leaderMemberId?: string | null;
      description?: string;
      sort?: number;
      status?: number;
    },
  ): Promise<DepartmentNodeVo> => request.put<DepartmentNodeVo>(`/departments/${id}`, data),

  remove: (id: string): Promise<null> => request.delete<null>(`/departments/${id}`),
};

export interface TermVo {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  status: number;
  statusLabel: string;
  memberCount: number;
}

export const termApi = {
  list: (): Promise<TermVo[]> => request.get<TermVo[]>('/terms'),

  create: (data: { name: string; startDate: string; endDate: string }): Promise<TermVo> =>
    request.post<TermVo>('/terms', data),

  update: (
    id: string,
    data: { name?: string; startDate?: string; endDate?: string; status?: number },
  ): Promise<TermVo> => request.put<TermVo>(`/terms/${id}`, data),

  setCurrent: (id: string): Promise<TermVo> => request.put<TermVo>(`/terms/${id}/current`),

  remove: (id: string): Promise<null> => request.delete<null>(`/terms/${id}`),
};
