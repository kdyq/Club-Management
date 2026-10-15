import { join } from 'node:path';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller.js';
import { SysConfigModule } from './common/config/sys-config.module.js';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard.js';
import { PermissionGuard } from './common/guards/permission.guard.js';
import { PrismaModule } from './common/prisma/prisma.module.js';
import { RedisModule } from './common/redis/redis.module.js';
import { ActivityModule } from './modules/activity/activity.module.js';
import { AnnouncementModule } from './modules/announcement/announcement.module.js';
import { ApprovalModule } from './modules/approval/approval.module.js';
import { AssetModule } from './modules/asset/asset.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { DepartmentModule } from './modules/department/department.module.js';
import { DutyModule } from './modules/duty/duty.module.js';
import { FileModule } from './modules/file/file.module.js';
import { FundModule } from './modules/fund/fund.module.js';
import { MemberModule } from './modules/member/member.module.js';
import { NotificationModule } from './modules/notification/notification.module.js';
import { PermissionModule } from './modules/permission/permission.module.js';
import { RoleModule } from './modules/role/role.module.js';
import { StatsModule } from './modules/stats/stats.module.js';
import { TermModule } from './modules/term/term.module.js';
import { VenueModule } from './modules/venue/venue.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // 开发时从 apps/server 启动，构建后从仓库根启动，两种 cwd 都要能找到根目录的 .env
      envFilePath: [join(process.cwd(), '.env'), join(process.cwd(), '..', '..', '.env')],
    }),
    PrismaModule,
    RedisModule,
    SysConfigModule,
    AuthModule,
    ApprovalModule,
    ActivityModule,
    DepartmentModule,
    TermModule,
    MemberModule,
    RoleModule,
    PermissionModule,
    StatsModule,
    FileModule,
    NotificationModule,
    AnnouncementModule,
    FundModule,
    DutyModule,
    AssetModule,
    VenueModule,
  ],
  controllers: [AppController],
  providers: [
    // 顺序要紧：JwtAuthGuard 先把 req.member 填上，PermissionGuard 才读得到权限
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionGuard },
  ],
})
export class AppModule {}
