/**
 * Redis 封装。用途：登录限流、首页聚合缓存、验证码、权限缓存、定时任务锁。
 *
 * 只暴露本项目需要的方法，不直接把 ioredis 客户端撒到业务代码里。
 */
import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { Redis } from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly client: Redis;

  constructor() {
    const url = process.env.REDIS_URL ?? 'redis://127.0.0.1:6379/0';
    this.client = new Redis(url, {
      lazyConnect: true,
      maxRetriesPerRequest: 2,
      // 连不上时不要疯狂重连刷屏，交给调用方降级
      retryStrategy: (times: number) => (times > 5 ? null : Math.min(times * 200, 2000)),
    });
    this.client.on('error', (error: Error) => {
      this.logger.warn(`Redis 连接异常：${error.message}`);
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.client.connect();
      await this.client.ping();
      this.logger.log('Redis 连接已建立');
    } catch (error) {
      this.logger.error(
        `Redis 连接失败，限流与缓存将不可用：${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    this.client.disconnect();
  }

  /** 缓存不可用时不应该让业务挂掉，所有调用点都走这里的降级 */
  private async safe<T>(action: () => Promise<T>, fallback: T): Promise<T> {
    try {
      return await action();
    } catch (error) {
      this.logger.warn(`Redis 操作失败，已降级：${error instanceof Error ? error.message : String(error)}`);
      return fallback;
    }
  }

  async get(key: string): Promise<string | null> {
    return this.safe(() => this.client.get(key), null);
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    await this.safe(async () => {
      if (ttlSeconds === undefined) {
        await this.client.set(key, value);
      } else {
        await this.client.set(key, value, 'EX', ttlSeconds);
      }
      return true;
    }, false);
  }

  async del(...keys: string[]): Promise<void> {
    if (keys.length === 0) return;
    await this.safe(async () => {
      await this.client.del(...keys);
      return true;
    }, false);
  }

  /** 自增并返回新值；首次自增时设置过期，用于「N 次失败后锁定」 */
  async incrWithTtl(key: string, ttlSeconds: number): Promise<number> {
    return this.safe(async () => {
      const value = await this.client.incr(key);
      if (value === 1) {
        await this.client.expire(key, ttlSeconds);
      }
      return value;
    }, 0);
  }

  /** 剩余过期秒数，用于告诉用户还要等多久 */
  async ttl(key: string): Promise<number> {
    return this.safe(() => this.client.ttl(key), -1);
  }

  async getJson<T>(key: string): Promise<T | null> {
    const raw = await this.get(key);
    if (raw === null) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  async setJson(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    await this.set(key, JSON.stringify(value), ttlSeconds);
  }

  /** 按前缀批量删除，用于「某角色的权限变更后清掉所有人的权限缓存」 */
  async delByPrefix(prefix: string): Promise<number> {
    return this.safe(async () => {
      let cursor = '0';
      let removed = 0;
      do {
        const [next, keys] = await this.client.scan(cursor, 'MATCH', `${prefix}*`, 'COUNT', 200);
        cursor = next;
        if (keys.length > 0) {
          await this.client.del(...keys);
          removed += keys.length;
        }
      } while (cursor !== '0');
      return removed;
    }, 0);
  }
}
