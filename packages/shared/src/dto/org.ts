/** 组织架构相关类型：部门树与届次。 */

export interface DepartmentMemberBrief {
  id: string;
  realName: string;
}

export interface DepartmentNodeVo {
  id: string;
  parentId: string | null;
  name: string;
  description: string | null;
  sort: number;
  status: number;
  leader: DepartmentMemberBrief | null;
  /** 本部门直属成员数（不含下级） */
  memberCount: number;
  children: DepartmentNodeVo[];
}

export interface DepartmentQuery {
  /** 是否包含停用的部门 */
  includeDisabled?: boolean;
}

export interface CreateDepartmentDto {
  name: string;
  parentId?: string | null;
  leaderMemberId?: string | null;
  description?: string;
  sort?: number;
}

export interface UpdateDepartmentDto extends Partial<CreateDepartmentDto> {
  status?: number;
}

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

export interface CreateTermDto {
  name: string;
  startDate: string;
  endDate: string;
}

export interface UpdateTermDto extends Partial<CreateTermDto> {
  status?: number;
}
