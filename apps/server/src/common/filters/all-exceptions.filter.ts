/**
 * 全局异常过滤器（开发文档 7.2 / 7.3 节）。
 *
 * 职责：
 * 1. 把任何抛出的东西包成 { code, message, data: null, traceId }
 * 2. 保持 HTTP 状态码语义正确，不要一律 200
 * 3. 把 Prisma 的唯一键冲突等错误映射成 409xx 并给出可读中文，不要把原始错误抛给前端
 * 4. 500 级错误记日志并带堆栈，4xx 不记（那是调用方的错，不是服务故障）
 */
import { randomUUID } from 'node:crypto';
import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ErrorCode, httpStatusOf, messageOf } from '@club/shared';

/** Prisma 已知错误码 → 业务错误码。用字符串判断，避免为了类型去 import Prisma 运行时。 */
const PRISMA_ERROR_MAP: Record<string, { code: number; message: string }> = {
  P2002: { code: ErrorCode.DUPLICATE_RECORD, message: '记录已存在，请检查是否重复提交' },
  P2003: { code: ErrorCode.BUSINESS_RULE_VIOLATED, message: '关联的数据不存在或仍被引用' },
  P2025: { code: ErrorCode.NOT_FOUND, message: '要操作的记录不存在' },
  P2000: { code: ErrorCode.PARAM_INVALID, message: '字段内容超出长度限制' },
  P2005: { code: ErrorCode.PARAM_INVALID, message: '字段类型不匹配' },
};

interface ErrorBody {
  code: number;
  message: string;
  data: null;
  traceId: string;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const traceId = request.traceId ?? randomUUID();
    const { status, code, message } = this.resolve(exception);

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `[${traceId}] ${request.method} ${request.originalUrl} → ${status} ${message}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    const body: ErrorBody = { code, message, data: null, traceId };
    response.status(status).json(body);
  }

  private resolve(exception: unknown): { status: number; code: number; message: string } {
    // 1) 业务异常与 NestJS 内置 HttpException
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();

      if (typeof payload === 'string') {
        return { status, code: status * 100 + 1, message: payload };
      }

      const record = payload as Record<string, unknown>;
      const rawMessage = record.message;
      const message = Array.isArray(rawMessage)
        ? rawMessage.join('；') // ValidationPipe 会给出字符串数组
        : typeof rawMessage === 'string'
          ? rawMessage
          : exception.message;
      const code = typeof record.code === 'number' ? record.code : status * 100 + 1;

      return { status, code, message };
    }

    // 2) Prisma 已知错误
    if (exception instanceof Error) {
      const prismaCode = (exception as { code?: unknown }).code;
      if (typeof prismaCode === 'string') {
        const mapped = PRISMA_ERROR_MAP[prismaCode];
        if (mapped !== undefined) {
          return { status: httpStatusOf(mapped.code), code: mapped.code, message: mapped.message };
        }
        if (prismaCode.startsWith('P')) {
          this.logger.error(`未映射的 Prisma 错误 ${prismaCode}: ${exception.message}`);
          return {
            status: HttpStatus.INTERNAL_SERVER_ERROR,
            code: ErrorCode.DATABASE_ERROR,
            message: messageOf(ErrorCode.DATABASE_ERROR),
          };
        }
      }
    }

    // 3) 兜底：不要把内部细节暴露给前端
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      code: ErrorCode.INTERNAL_ERROR,
      message: messageOf(ErrorCode.INTERNAL_ERROR),
    };
  }
}
