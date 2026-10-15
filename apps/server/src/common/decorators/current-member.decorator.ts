import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import {
  requireMember,
  type AuthenticatedRequest,
} from '../types/authenticated-request.js';
import type { MemberContext } from '../types/member-context.js';

/** 取出当前登录者上下文。只能用在经过 JwtAuthGuard 的路由上。 */
export const CurrentMember = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): MemberContext =>
    requireMember(ctx.switchToHttp().getRequest<AuthenticatedRequest>()),
);
