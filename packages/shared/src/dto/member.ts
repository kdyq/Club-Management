/** 成员相关的请求与响应类型，前后端共用。 */
import type { PageQuery } from '../types/api.js';

export interface MemberRoleBriefVo {
  id: string;
  code: string;
  name: string;
}

export interface MemberVo {
  id: string;
  memberNo: string | null;
  realName: string;
  studentNo: string | null;
  gender: number;
  grade: string | null;
  major: string | null;
  className: string | null;
  phone: string | null;
  email: string | null;
  avatarUrl: string | null;
  deptId: string | null;
  deptName: string | null;
  position: number;
  positionLabel: string;
  status: number;
  statusLabel: string;
  isCore: boolean;
  totalPoints: number;
  joinDate: string | null;
  roles: MemberRoleBriefVo[];
}

export interface MemberQuery extends PageQuery {
  /** 姓名、学号、成员编号的模糊搜索 */
  keyword?: string;
  deptId?: string;
  status?: number;
  position?: number;
}

/** 角色 */
export interface RoleVo {
  id: string;
  name: string;
  code: string;
  dataScope: number;
  dataScopeLabel: string;
  description: string | null;
  isSystem: boolean;
  sort: number;
  status: number;
  /** 已分配的权限码 */
  permissionCodes: string[];
  memberCount: number;
}

export interface RoleQuery extends PageQuery {
  keyword?: string;
  status?: number;
}

export interface CreateRoleDto {
  name: string;
  code: string;
  dataScope: number;
  description?: string;
  sort?: number;
}

export interface UpdateRoleDto extends Partial<CreateRoleDto> {
  status?: number;
}

/** 权限树节点 */
export interface PermissionNodeVo {
  id: string;
  parentId: string | null;
  name: string;
  code: string;
  type: number;
  path: string | null;
  icon: string | null;
  sort: number;
  children: PermissionNodeVo[];
}
