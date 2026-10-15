/**
 * 每个请求生成一个 traceId，回写到响应头，并挂在 req 上供拦截器与过滤器使用。
 *
 * 用 express 中间件而不是 NestJS 的 MiddlewareConsumer：后者要写路由通配符，
 * 而通配符语法在 Nest 12 上跟 path-to-regexp 的版本绑定，容易踩坑。
 * 这里只需要「所有请求都过一遍」，用 app.use() 更直接。
 */
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

declare module 'express-serve-static-core' {
  interface Request {
    traceId?: string;
  }
}

export function traceIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  // 上游带了就复用，便于链路追踪
  const traceId = req.header('x-trace-id') ?? randomUUID();
  req.traceId = traceId;
  res.setHeader('x-trace-id', traceId);
  next();
}
