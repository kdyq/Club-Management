/**
 * 统一成功响应体（开发文档 7.2 节）。
 *
 *   { code: 0, message: "ok", data: T, traceId: "..." }
 *
 * Controller 里直接 return 业务数据即可，不要手动拼这一层。
 * 少数需要自定义 message 的场景，返回带有 code/message/data 形状的对象会被
 * 原样透出，不再二次包装。
 */
import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import type { Request } from 'express';
import { map, type Observable } from 'rxjs';
import type { ApiResponse } from '@club/shared';

function isEnvelope(value: unknown): value is ApiResponse<unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'code' in value &&
    'message' in value &&
    'data' in value
  );
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, ApiResponse<T> | T> {
  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<ApiResponse<T> | T> {
    const request = context.switchToHttp().getRequest<Request>();

    return next.handle().pipe(
      map((data) => {
        if (isEnvelope(data)) return data;
        const body: ApiResponse<T> = { code: 0, message: 'ok', data };
        if (request.traceId !== undefined) body.traceId = request.traceId;
        return body;
      }),
    );
  }
}
