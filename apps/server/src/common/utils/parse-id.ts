import { ErrorCode } from '@club/shared';
import { BizException } from '../exceptions/biz.exception.js';

/**
 * 把路径参数里的 id 转成 bigint。
 *
 * 前端传来的 id 是字符串（BigInt 序列化的结果），直接 BigInt() 会在
 * 非法输入时抛 SyntaxError，那样会变成 500。这里统一转成 400。
 */
export function parseId(raw: string): bigint {
  if (!/^\d+$/.test(raw)) {
    throw new BizException(ErrorCode.PARAM_INVALID, `路径参数 ${raw} 不是合法的 id`);
  }
  return BigInt(raw);
}
