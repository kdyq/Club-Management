/**
 * 当前登录者的上下文。由 JwtStrategy 组装、@CurrentMember() 取出。
 *
 * 权限与数据范围都在这里，业务代码只依赖这个对象，不自己去查角色表。
 */
import type { DataScope } from '@club/shared';

export interface MemberRoleBrief {
  id: bigint;
  code: string;
  name: string;
  dataScope: DataScope;
}

export interface MemberContext {
  userId: bigint;
  memberId: bigint;
  clubId: bigint;
  termId: bigint;
  deptId: bigint | null;
  deptName: string | null;
  memberNo: string | null;
  realName: string;
  position: number;
  /** 功能权限码集合，Guard 用它判「能不能做」 */
  permissions: Set<string>;
  roles: MemberRoleBrief[];
  /** 多角色取并集后的最大数据范围，用它判「能看谁的数据」 */
  maxDataScope: DataScope;
}
