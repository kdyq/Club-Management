/**
 * 声明接口需要的功能权限（开发文档 7.5 节第一层）。
 *
 * 用法：
 *   @RequirePerm('member:create')
 *   @RequireAnyPerm('member:update', 'member:delete')
 *   @RequireAllPerm('fund:create', 'fund:approve')
 *
 * 没声明就默认放行（只校验登录），所以**新接口要自觉加上**，
 * 提交前的自检清单第一条就是「新增接口有没有加 @RequirePerm」。
 */
import { SetMetadata } from '@nestjs/common';
import type { PermissionCode } from '@club/shared';

export const PERMISSIONS_KEY = 'requiredPermissions';

export type PermLogic = 'and' | 'or';

export interface RequiredPermission {
  codes: readonly string[];
  logic: PermLogic;
}

export const RequirePerm = (code: PermissionCode | string): MethodDecorator =>
  SetMetadata(PERMISSIONS_KEY, { codes: [code], logic: 'or' } satisfies RequiredPermission);

export const RequireAnyPerm = (...codes: (PermissionCode | string)[]): MethodDecorator =>
  SetMetadata(PERMISSIONS_KEY, { codes, logic: 'or' } satisfies RequiredPermission);

export const RequireAllPerm = (...codes: (PermissionCode | string)[]): MethodDecorator =>
  SetMetadata(PERMISSIONS_KEY, { codes, logic: 'and' } satisfies RequiredPermission);
