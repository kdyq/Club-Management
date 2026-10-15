import { Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { ApprovalController } from './approval.controller.js';
import { ApprovalHandlerRegistry } from './approval-handler.registry.js';
import { ApprovalService } from './approval.service.js';

/**
 * 审批引擎。DiscoveryModule 用于扫描实现了 ApprovableHandler 的业务 provider，
 * 所以业务模块只要提供处理器即可，不需要反向依赖审批模块的注册接口。
 */
@Module({
  imports: [DiscoveryModule],
  controllers: [ApprovalController],
  providers: [ApprovalService, ApprovalHandlerRegistry],
  exports: [ApprovalService, ApprovalHandlerRegistry],
})
export class ApprovalModule {}
