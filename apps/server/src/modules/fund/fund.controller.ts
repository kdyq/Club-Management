import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type {
  FeeStandardVo,
  FundAccountVo,
  FundBudgetVo,
  FundCategoryVo,
  FundOverviewVo,
  FundTransactionVo,
  MemberFeeVo,
  PageResult,
  ReconcileResultVo,
} from '@club/shared';
import { CurrentMember } from '../../common/decorators/current-member.decorator.js';
import { RequirePerm } from '../../common/decorators/require-perm.decorator.js';
import type { MemberContext } from '../../common/types/member-context.js';
import { parseId } from '../../common/utils/parse-id.js';
import { BudgetService } from './budget.service.js';
import {
  CreateAccountDto,
  CreateBudgetDto,
  CreateFundCategoryDto,
  CreateFeeStandardDto,
  CreateTransactionDto,
  PayFeeDto,
  QueryBudgetDto,
  QueryFeeDto,
  QueryTransactionDto,
  VoidTransactionDto,
  WaiveFeeDto,
} from './dto/fund.dto.js';
import { FeeService } from './fee.service.js';
import { FundService } from './fund.service.js';
import { ReconcileService } from './reconcile.service.js';

@ApiTags('经费')
@Controller('fund')
export class FundController {
  constructor(
    private readonly fundService: FundService,
    private readonly budgetService: BudgetService,
    private readonly feeService: FeeService,
    private readonly reconcileService: ReconcileService,
  ) {}

  // ---------------------------------------------------------------------------
  // 账户与科目
  // ---------------------------------------------------------------------------

  @Get('accounts')
  @RequirePerm('fund:read')
  @ApiOperation({ summary: '经费账户', description: '余额由已入账流水汇总算出，不是存储字段' })
  async accounts(@CurrentMember() me: MemberContext): Promise<FundAccountVo[]> {
    return this.fundService.accounts(me);
  }

  @Post('accounts')
  @RequirePerm('fund:create')
  @ApiOperation({ summary: '新增账户' })
  async createAccount(
    @CurrentMember() me: MemberContext,
    @Body() dto: CreateAccountDto,
  ): Promise<FundAccountVo> {
    return this.fundService.createAccount(me, dto);
  }

  @Get('categories')
  @RequirePerm('fund:read')
  @ApiOperation({ summary: '经费科目树' })
  async categories(@CurrentMember() me: MemberContext): Promise<FundCategoryVo[]> {
    return this.fundService.categories(me);
  }

  @Post('categories')
  @RequirePerm('fund:create')
  @ApiOperation({ summary: '新增科目' })
  async createCategory(
    @CurrentMember() me: MemberContext,
    @Body() dto: CreateFundCategoryDto,
  ): Promise<FundCategoryVo> {
    return this.fundService.createCategory(me, dto);
  }

  // ---------------------------------------------------------------------------
  // 流水
  // ---------------------------------------------------------------------------

  @Get('transactions')
  @RequirePerm('fund:read')
  @ApiOperation({ summary: '收支流水' })
  async transactions(
    @CurrentMember() me: MemberContext,
    @Query() query: QueryTransactionDto,
  ): Promise<PageResult<FundTransactionVo>> {
    return this.fundService.transactions(me, query);
  }

  @Post('transactions')
  @RequirePerm('fund:create')
  @ApiOperation({
    summary: '登记收支',
    description: '默认直接入账；需要审批时先挂待审批，通过后才计入余额。',
  })
  async createTransaction(
    @CurrentMember() me: MemberContext,
    @Body() dto: CreateTransactionDto,
  ): Promise<FundTransactionVo> {
    return this.fundService.createTransaction(me, dto);
  }

  @Post('transactions/:id/void')
  @RequirePerm('fund:update')
  @ApiOperation({
    summary: '作废流水',
    description: '财务流水**只作废不删除**：改状态并记原因，原记录留在库里可供审计。',
  })
  async voidTransaction(
    @CurrentMember() me: MemberContext,
    @Param('id') id: string,
    @Body() dto: VoidTransactionDto,
  ): Promise<FundTransactionVo> {
    return this.fundService.voidTransaction(me, parseId(id), dto.reason);
  }

  @Post('transactions/:id/vouchers')
  @RequirePerm('fund:update')
  @ApiOperation({ summary: '给流水补凭证' })
  async attachVouchers(
    @CurrentMember() me: MemberContext,
    @Param('id') id: string,
    @Body() dto: { fileIds: string[] },
  ): Promise<{ count: number }> {
    return this.fundService.attachVouchers(me, parseId(id), dto.fileIds);
  }

  // ---------------------------------------------------------------------------
  // 公示页
  // ---------------------------------------------------------------------------

  @Get('overview')
  @RequirePerm('fund:read')
  @ApiOperation({ summary: '财务公示总览', description: '总额、本月收支、科目构成与近 6 个月趋势' })
  async overview(@CurrentMember() me: MemberContext): Promise<FundOverviewVo> {
    return this.fundService.overview(me);
  }

  // ---------------------------------------------------------------------------
  // 预算
  // ---------------------------------------------------------------------------

  @Get('budgets')
  @RequirePerm('budget:read')
  @ApiOperation({ summary: '预算列表', description: '执行率由已入账支出流水实时算出' })
  async budgets(
    @CurrentMember() me: MemberContext,
    @Query() query: QueryBudgetDto,
  ): Promise<PageResult<FundBudgetVo>> {
    return this.budgetService.page(me, query);
  }

  @Post('budgets')
  @RequirePerm('budget:create')
  @ApiOperation({ summary: '新增预算', description: '创建后是草稿，需再提交审批' })
  async createBudget(
    @CurrentMember() me: MemberContext,
    @Body() dto: CreateBudgetDto,
  ): Promise<FundBudgetVo> {
    return this.budgetService.create(me, dto);
  }

  @Post('budgets/:id/submit')
  @RequirePerm('budget:update')
  @ApiOperation({ summary: '提交预算审批' })
  async submitBudget(
    @CurrentMember() me: MemberContext,
    @Param('id') id: string,
  ): Promise<{ approvalInstanceId: string }> {
    return this.budgetService.submit(me, parseId(id));
  }

  @Post('budgets/:id/close')
  @RequirePerm('budget:update')
  @ApiOperation({ summary: '关闭预算' })
  async closeBudget(
    @CurrentMember() me: MemberContext,
    @Param('id') id: string,
  ): Promise<FundBudgetVo> {
    return this.budgetService.close(me, parseId(id));
  }

  // ---------------------------------------------------------------------------
  // 会费
  // ---------------------------------------------------------------------------

  @Get('fee-standards')
  @RequirePerm('fee:read')
  @ApiOperation({ summary: '会费标准' })
  async feeStandards(@CurrentMember() me: MemberContext): Promise<FeeStandardVo[]> {
    return this.feeService.standards(me);
  }

  @Post('fee-standards')
  @RequirePerm('fee:create')
  @ApiOperation({ summary: '建会费标准并生成应缴名单' })
  async createFeeStandard(
    @CurrentMember() me: MemberContext,
    @Body() dto: CreateFeeStandardDto,
  ): Promise<FeeStandardVo> {
    return this.feeService.createStandard(me, dto);
  }

  @Post('fee-standards/:id/remind')
  @RequirePerm('fee:update')
  @ApiOperation({ summary: '催缴', description: '给欠费成员发站内信；同一次催缴重复点不会重复发' })
  async remind(
    @CurrentMember() me: MemberContext,
    @Param('id') id: string,
  ): Promise<{ notified: number; skipped: boolean }> {
    return this.feeService.remind(me, parseId(id));
  }

  @Get('fees')
  @RequirePerm('fee:read')
  @ApiOperation({ summary: '应缴明细' })
  async fees(
    @CurrentMember() me: MemberContext,
    @Query() query: QueryFeeDto,
  ): Promise<PageResult<MemberFeeVo>> {
    return this.feeService.fees(me, query);
  }

  @Post('fees/:id/pay')
  @RequirePerm('fee:update')
  @ApiOperation({
    summary: '登记缴费',
    description: '同时派生一笔收入流水，两者在同一事务内，保证账面与缴费记录一致。',
  })
  async pay(
    @CurrentMember() me: MemberContext,
    @Param('id') id: string,
    @Body() dto: PayFeeDto,
  ): Promise<{ fee: MemberFeeVo; transactionId: string | null }> {
    return this.feeService.pay(me, parseId(id), dto);
  }

  @Post('fees/:id/waive')
  @RequirePerm('fee:update')
  @ApiOperation({ summary: '减免会费' })
  async waive(
    @CurrentMember() me: MemberContext,
    @Param('id') id: string,
    @Body() dto: WaiveFeeDto,
  ): Promise<MemberFeeVo> {
    return this.feeService.waive(me, parseId(id), dto.reason);
  }

  @Get('arrears')
  @RequirePerm('fee:read')
  @ApiOperation({ summary: '欠费统计' })
  async arrears(
    @CurrentMember() me: MemberContext,
    @Query('feeStandardId') feeStandardId?: string,
  ): Promise<{
    totalMembers: number;
    unpaidCount: number;
    partialCount: number;
    paidCount: number;
    waivedCount: number;
    shouldTotal: string;
    paidTotal: string;
    outstandingTotal: string;
  }> {
    return this.feeService.arrears(me, feeStandardId);
  }
}

@ApiTags('系统')
@Controller('admin')
export class ReconcileController {
  constructor(private readonly reconcileService: ReconcileService) {}

  @Post('reconcile')
  @RequirePerm('reconcile:update')
  @ApiOperation({
    summary: '数据对账',
    description:
      '重算所有缓存字段（成员积分、预算已用、会费状态、物资可借数）。' +
      '准的永远是流水与明细表，缓存只是为了加速，这里把它们按流水重建。',
  })
  async reconcile(@CurrentMember() me: MemberContext): Promise<ReconcileResultVo> {
    return this.reconcileService.runAll(me);
  }
}
