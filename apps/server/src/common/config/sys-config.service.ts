/**
 * 读 sys_config 里的运行参数（单文件大小上限、签到二维码有效期等）。
 *
 * 走 Redis 缓存 60 秒，避免每个请求都查一次库；改参数时清掉缓存即可。
 * 配置项缺失时用调用方给的默认值，不让服务因为少一条配置就起不来。
 */
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { RedisService } from '../redis/redis.service.js';

const CACHE_TTL_SECONDS = 60;
const CACHE_PREFIX = 'syscfg:';

@Injectable()
export class SysConfigService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async get(key: string): Promise<string | undefined> {
    const cacheKey = `${CACHE_PREFIX}${key}`;
    const cached = await this.redis.get(cacheKey);
    if (cached !== null) {
      // 空字符串代表「查过但没有」，避免击穿
      return cached === '' ? undefined : cached;
    }

    const row = await this.prisma.client.sysConfig.findFirst({
      where: { configKey: key, deletedAt: 0n },
      select: { configValue: true },
    });
    await this.redis.set(cacheKey, row?.configValue ?? '', CACHE_TTL_SECONDS);
    return row?.configValue;
  }

  async getBool(key: string, fallback: boolean): Promise<boolean> {
    const raw = await this.get(key);
    if (raw === undefined) return fallback;
    return raw === 'true' || raw === '1';
  }

  async getInt(key: string, fallback: number): Promise<number> {
    const raw = await this.get(key);
    if (raw === undefined) return fallback;
    const parsed = Number.parseInt(raw, 10);
    return Number.isNaN(parsed) ? fallback : parsed;
  }

  /** 改过配置后由配置模块调用 */
  async invalidate(key?: string): Promise<void> {
    if (key === undefined) {
      await this.redis.delByPrefix(CACHE_PREFIX);
      return;
    }
    await this.redis.del(`${CACHE_PREFIX}${key}`);
  }
}
