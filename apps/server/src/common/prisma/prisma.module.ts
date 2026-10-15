import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service.js';

/** 全局模块：各业务模块直接注入 PrismaService，不必逐个 import */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
