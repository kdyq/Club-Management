/**
 * Prisma 客户端。Prisma 7 起运行时连接由 driver adapter 提供，
 * 连接串仍从仓库根目录的 .env 读（开发文档 5.2 节）。
 *
 * 对外暴露的是**带软删除扩展的客户端**，业务代码统一写 `this.prisma.client.xxx`。
 * 手写 SQL（$queryRaw）不走扩展，需要自己带 deleted_at 条件。
 */
import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '@prisma/client';
import {
  createExtendedPrismaClient,
  type ExtendedPrismaClient,
  type PrismaTransactionClient,
} from './soft-delete.extension.js';

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private readonly base: PrismaClient;

  /** 业务代码用这个：this.prisma.client.member.findMany(...) */
  readonly client: ExtendedPrismaClient;

  constructor() {
    const url = process.env.DATABASE_URL;
    if (url === undefined || url === '') {
      throw new Error('缺少 DATABASE_URL，请确认仓库根目录的 .env 已按开发文档 5.2 节配置');
    }
    this.base = new PrismaClient({ adapter: new PrismaMariaDb(url) });
    this.client = createExtendedPrismaClient(this.base);
  }

  async onModuleInit(): Promise<void> {
    await this.base.$connect();
    this.logger.log('数据库连接已建立（已挂载软删除扩展）');
  }

  async onModuleDestroy(): Promise<void> {
    await this.base.$disconnect();
  }

  /**
   * 事务。必须从扩展客户端发起，这样回调里的软删除规则才生效。
   * 事务客户端上没有 $extends，所以不能在回调里再挂扩展。
   */
  async transaction<T>(fn: (tx: PrismaTransactionClient) => Promise<T>): Promise<T> {
    return this.client.$transaction(fn);
  }
}
