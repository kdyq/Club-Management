/**
 * Prisma 客户端。Prisma 7 起运行时连接由 driver adapter 提供，
 * 连接串仍从仓库根目录的 .env 读（开发文档 5.2 节）。
 *
 * 软删除扩展与数据范围扩展在阶段 1、2 接入时挂到 $extends 上。
 */
import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    const url = process.env.DATABASE_URL;
    if (url === undefined || url === '') {
      throw new Error('缺少 DATABASE_URL，请确认仓库根目录的 .env 已按开发文档 5.2 节配置');
    }
    super({ adapter: new PrismaMariaDb(url) });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('数据库连接已建立');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
