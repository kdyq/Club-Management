import { Module } from '@nestjs/common';
import { ApprovalModule } from '../approval/approval.module.js';
import { ActivityApprovalHandler } from './activity-approval.handler.js';
import { ActivityController } from './activity.controller.js';
import { ActivityService } from './activity.service.js';
import { CheckinService } from './checkin.service.js';
import { LeaveService } from './leave.service.js';
import { RegistrationService } from './registration.service.js';

/**
 * 活动模块。ActivityApprovalHandler 实现了 ApprovableHandler，
 * 审批模块会通过 DiscoveryService 自动发现它。
 */
@Module({
  imports: [ApprovalModule],
  controllers: [ActivityController],
  providers: [
    ActivityService,
    RegistrationService,
    CheckinService,
    LeaveService,
    ActivityApprovalHandler,
  ],
  exports: [ActivityService],
})
export class ActivityModule {}
