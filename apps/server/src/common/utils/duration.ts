/** 把 '2h' / '14d' / '30m' / '45s' 这类时长解析成秒。解析不了就返回兜底值。 */
export function parseDurationSeconds(input: string | undefined, fallbackSeconds: number): number {
  if (input === undefined || input === '') return fallbackSeconds;
  const match = /^(\d+)\s*([smhd])$/.exec(input.trim());
  if (match === null) {
    const plain = Number.parseInt(input, 10);
    return Number.isNaN(plain) ? fallbackSeconds : plain;
  }
  const amount = Number.parseInt(match[1] as string, 10);
  const unit = match[2];
  const factor = unit === 's' ? 1 : unit === 'm' ? 60 : unit === 'h' ? 3600 : 86400;
  return amount * factor;
}
