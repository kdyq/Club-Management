import type {
  CreateRoleDto,
  PageResult,
  PermissionNodeVo,
  RoleQuery,
  RoleVo,
  UpdateRoleDto,
} from '@club/shared';
import { request } from './http';

export const roleApi = {
  page: (params: RoleQuery): Promise<PageResult<RoleVo>> =>
    request.get<PageResult<RoleVo>>('/roles', { params }),

  options: (): Promise<{ id: string; name: string; code: string }[]> =>
    request.get('/roles/options'),

  create: (data: CreateRoleDto): Promise<RoleVo> => request.post<RoleVo>('/roles', data),

  update: (id: string, data: UpdateRoleDto): Promise<RoleVo> =>
    request.put<RoleVo>(`/roles/${id}`, data),

  remove: (id: string): Promise<null> => request.delete<null>(`/roles/${id}`),

  permissionCodes: (id: string): Promise<string[]> =>
    request.get<string[]>(`/roles/${id}/permissions`),

  assignPermissions: (id: string, permissionCodes: string[]): Promise<string[]> =>
    request.put<string[]>(`/roles/${id}/permissions`, { permissionCodes }),
};

export const permissionApi = {
  tree: (): Promise<PermissionNodeVo[]> => request.get<PermissionNodeVo[]>('/permissions/tree'),
  flat: (): Promise<{ code: string; name: string; type: number }[]> =>
    request.get('/permissions/flat'),
};
