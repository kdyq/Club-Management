/**
 * 活动接入审批引擎的处理器（开发文档 7.6 节）。
 *
 * 它由 ApprovalHandlerRegistry 通过 DiscoveryService 自动登记，
 * 不需要在审批模块里写任何活动相关的分支——这也是「审批引擎不随业务表增加而改造」的体现。
 */
import { Injectable } from '@nestjs/common';
import { BizType } from '@club/shared';
import { ActivityService } from './activity.service.js';
import type {
  ApprovableHandler,
  ApprovableInstance,
} from '../approval/types/approvable-handler.js';

@Injectable()
export class ActivityApprovalHandler implements ApprovableHandler {
  readonly bizType = BizType.ACTIVITY;

  constructor(private readonly activityService: ActivityService) {}

  async onApproved(instance: ApprovableInstance): Promise<void> {
    await this.activityService.onApproved(instance);
  }

  async onRejected(instance: ApprovableInstance, opinion: string): Promise<void> {
    await this.activityService.onRejected(instance);
    void opinion;
  }
}
