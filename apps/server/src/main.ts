import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module.js';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';
import { TransformInterceptor } from './common/interceptors/transform.interceptor.js';
import { traceIdMiddleware } from './common/middleware/trace-id.middleware.js';
import { installBigIntJsonPatch } from './common/serialization/bigint-json.js';

const logger = new Logger('Bootstrap');

async function bootstrap(): Promise<void> {
  // 必须在任何响应序列化之前装好，否则 BigInt 主键会让接口 500
  installBigIntJsonPatch();

  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.setGlobalPrefix('api');
  app.use(traceIdMiddleware);
  // refresh token 走 httpOnly Cookie，需要解析
  app.use(cookieParser());

  // DTO 用 class-validator 声明校验规则，这里统一开启；不要手写参数校验
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter());

  // 生产环境由 NestJS 单进程托管前端产物（开发文档 14.2 节）。
  // 开发期前端跑 Vite dev server，这里目录不存在就跳过，不要因此启动失败。
  const webDist = join(import.meta.dirname, '..', '..', 'web', 'dist');
  if (existsSync(webDist)) {
    app.useStaticAssets(webDist);
    logger.log(`前端静态资源已托管：${webDist}`);
  }

  const swaggerEnabled = process.env.NODE_ENV !== 'production';
  if (swaggerEnabled) {
    const config = new DocumentBuilder()
      .setTitle('社团管理系统 API')
      .setDescription('成员、活动、经费一体化管理。响应体统一为 { code, message, data, traceId }。')
      .setVersion('1.0')
      .addBearerAuth(
        { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        'access-token',
      )
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: { persistAuthorization: true, docExpansion: 'none' },
    });
  }

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);

  logger.log(`后端已启动：http://127.0.0.1:${port}/api`);
  if (swaggerEnabled) {
    logger.log(`接口文档：http://127.0.0.1:${port}/api/docs`);
  }
}

void bootstrap();
