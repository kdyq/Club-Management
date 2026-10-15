/**
 * 让 JSON.stringify 能处理 BigInt。
 *
 * 背景：MySQL 的 BIGINT UNSIGNED 主键在 Prisma 里是 JS 的 BigInt，
 * 而 `JSON.stringify({ id: 1n })` 会直接抛 TypeError。本项目 62 张表的
 * 主键与外键全是 BigInt，逐个在 VO 里手写转换迟早会漏，漏一处就是 500。
 * 统一在这里把 BigInt 序列化成字符串。
 *
 * 副作用（有意为之）：接口返回的 id 一律是字符串，前端类型按 string 处理。
 * 不用 number 是因为 BIGINT UNSIGNED 会超过 Number.MAX_SAFE_INTEGER。
 */
declare global {
  interface BigInt {
    toJSON(): string;
  }
}

export function installBigIntJsonPatch(): void {
  if (typeof BigInt.prototype.toJSON === 'function') return;
  Object.defineProperty(BigInt.prototype, 'toJSON', {
    value: function toJSON(this: bigint): string {
      return this.toString();
    },
    writable: true,
    configurable: true,
    enumerable: false,
  });
}
