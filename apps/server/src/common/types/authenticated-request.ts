import type { Request } from 'express';
import type { MemberContext } from './member-context.js';

/**
 * 经过 JwtAuthGuard 的请求。
 *
 * 注意属性名是 `user` 而不是自定义名字：@nestjs/passport 的 AuthGuard
 * 会把 JwtStrategy.validate() 的返回值挂到 `req.user` 上，这是 passport 的约定。
 * 这里用交叉类型而不是给 express 做全局声明合并，避免和 @types/passport
 * 已有的 Express.User 声明打架。
 */
export type AuthenticatedRequest = Request & { user?: MemberContext };

/** 取当前登录者；没经过守卫就说明用法错了，属于编码错误而不是业务错误 */
export function requireMember(request: AuthenticatedRequest): MemberContext {
  if (request.user === undefined) {
    throw new Error('该路由没有经过 JwtAuthGuard，取不到登录者上下文');
  }
  return request.user;
}
