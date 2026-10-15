import { join } from 'node:path';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // 开发时从 apps/server 启动，构建后从仓库根启动，两种 cwd 都要能找到根目录的 .env
      envFilePath: [join(process.cwd(), '.env'), join(process.cwd(), '..', '..', '.env')],
    }),
  ],
  controllers: [AppController],
})
export class AppModule {}
