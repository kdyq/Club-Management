// Prisma 7 的配置文件：schema 位置、迁移使用的连接串、种子命令都在这里。
// 连接串仍放在仓库根目录的 .env（见开发文档 5.2 节），此处显式加载。
import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: env('DATABASE_URL'),
  },
  migrations: {
    seed: 'tsx prisma/seed.ts',
  },
});
