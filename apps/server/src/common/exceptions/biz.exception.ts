/**
 * 业务异常。Service 层抛它，全局过滤器负责包装成统一响应体。
 *
 * 用法：
 *   throw new BizException(ErrorCode.ACTIVITY_FULL);
 *   throw new BizException(ErrorCode.DUPLICATE_RECORD, '该学号已经被录入');
 */
import { HttpException } from '@nestjs/common';
import { ErrorCode, httpStatusOf, messageOf } from '@club/shared';

export class BizException extends HttpException {
  readonly bizCode: number;

  constructor(bizCode: ErrorCode | number, message?: string) {
    const status = httpStatusOf(bizCode);
    super({ code: bizCode, message: message ?? messageOf(bizCode as ErrorCode) }, status);
    this.bizCode = bizCode;
  }
}
