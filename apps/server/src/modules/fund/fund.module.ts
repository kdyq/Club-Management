import { Module } from '@nestjs/common';
import { ApprovalModule } from '../approval/approval.module.js';
import { NotificationModule } from '../notification/notification.module.js';
import { BudgetService } from './budget.service.js';
import { FeeService } from './fee.service.js';
import {
  FundBudgetApprovalHandler,
  FundTransactionApprovalHandler,
} from './fund-approval.handler.js';
import { FundController, ReconcileController } from './fund.controller.js';
import { FundService } from './fund.service.js';
import { ReconcileService } from './reconcile.service.js';

@Module({
  imports: [ApprovalModule, NotificationModule],
  controllers: [FundController, ReconcileController],
  providers: [
    FundService,
    BudgetService,
    FeeService,
    ReconcileService,
    FundTransactionApprovalHandler,
    FundBudgetApprovalHandler,
  ],
  exports: [FundService, FeeService, BudgetService, ReconcileService],
})
export class FundModule {}
