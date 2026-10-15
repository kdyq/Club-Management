import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ErrorCode } from '@club/shared';
import {
  PERMISSIONS_KEY,
  type RequiredPermission,
} from '../decorators/require-perm.decorator.js';
import { BizException } from '../exceptions/biz.exception.js';
import type { AuthenticatedRequest } from '../types/authenticated-request.js';

/**
 * 功能权限校验（开发文档 7.5 节第一层）。
 * 数据范围是第二层，由 Service 层调用 buildScopeWhere 落地——两层缺一不可。
 */
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<RequiredPermission | undefined>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    // 没声明权限要求的接口只要求登录
    if (required === undefined) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const member = request.user;
    if (member === undefined) {
      throw new BizException(ErrorCode.UNAUTHORIZED);
    }

    const granted =
      required.logic === 'and'
        ? required.codes.every((code) => member.permissions.has(code))
        : required.codes.some((code) => member.permissions.has(code));

    if (!granted) {
      throw new BizException(
        ErrorCode.FORBIDDEN,
        `没有该操作的权限（需要 ${required.codes.join(required.logic === 'and' ? ' 且 ' : ' 或 ')}）`,
      );
    }
    return true;
  }
}
