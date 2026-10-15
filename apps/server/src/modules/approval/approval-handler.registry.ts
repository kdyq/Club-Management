/**
 * 业务处理器注册表。
 *
 * 用 NestJS 的 DiscoveryService 扫描所有 provider，凡是实现了 ApprovableHandler
 * 的就按 bizType 登记。这样新增业务类型时**不需要改审批模块**，
 * 只要在业务模块里实现接口即可。
 */
import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';
import { isApprovableHandler, type ApprovableHandler } from './types/approvable-handler.js';

@Injectable()
export class ApprovalHandlerRegistry implements OnModuleInit {
  private readonly logger = new Logger(ApprovalHandlerRegistry.name);
  private readonly handlers = new Map<string, ApprovableHandler>();

  constructor(private readonly discovery: DiscoveryService) {}

  onModuleInit(): void {
    for (const wrapper of this.discovery.getProviders()) {
      const instance: unknown = wrapper.instance;
      if (isApprovableHandler(instance)) {
        if (this.handlers.has(instance.bizType)) {
          this.logger.warn(
            `bizType「${instance.bizType}」被注册了多次，后注册的会覆盖先注册的，请检查`,
          );
        }
        this.handlers.set(instance.bizType, instance);
      }
    }
    this.logger.log(
      `已登记 ${this.handlers.size} 个审批业务处理器：${[...this.handlers.keys()].join('、') || '（无）'}`,
    );
  }

  get(bizType: string): ApprovableHandler | undefined {
    return this.handlers.get(bizType);
  }

  /** 启动时自检用：流程配了 bizType 但没有对应的处理器，通过后就不会有业务动作 */
  registeredTypes(): string[] {
    return [...this.handlers.keys()];
  }
}
