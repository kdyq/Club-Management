/**
 * 经费与预算接入审批引擎的处理器。
 *
 * 审批引擎按 bizType 一对一注册，所以经费流水和预算要分成两个处理器类——
 * 这正是「业务模块自己声明 bizType」的好处：引擎侧不需要认识这两个概念。
 */
import { Injectable } from '@nestjs/common';
import { BizType } from '@club/shared';
import type {
  ApprovableHandler,
  ApprovableInstance,
} from '../approval/types/approvable-handler.js';
import { BudgetService } from './budget.service.js';
import { FundService } from './fund.service.js';

@Injectable()
export class FundTransactionApprovalHandler implements ApprovableHandler {
  readonly bizType = BizType.FUND;

  constructor(private readonly fundService: FundService) {}

  async onApproved(instance: ApprovableInstance): Promise<void> {
    await this.fundService.onApproved(instance);
  }

  async onRejected(instance: ApprovableInstance, opinion: string): Promise<void> {
    await this.fundService.onRejected(instance, opinion);
  }
}

@Injectable()
export class FundBudgetApprovalHandler implements ApprovableHandler {
  readonly bizType = BizType.BUDGET;

  constructor(private readonly budgetService: BudgetService) {}

  async onApproved(instance: ApprovableInstance): Promise<void> {
    await this.budgetService.onApproved(instance);
  }

  async onRejected(instance: ApprovableInstance, opinion: string): Promise<void> {
    // 预算被驳回时把意见留在名称里没意义，这里只改状态；
    // 审批实例本身保留了完整意见，详情页能看到
    void opinion;
    await this.budgetService.onRejected(instance);
  }
}
