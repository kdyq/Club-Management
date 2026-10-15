import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { ApprovalInstanceVo, ApprovalTaskListItemVo, PageResult } from '@club/shared';
import { CurrentMember } from '../../common/decorators/current-member.decorator.js';
import { RequirePerm } from '../../common/decorators/require-perm.decorator.js';
import type { MemberContext } from '../../common/types/member-context.js';
import { parseId } from '../../common/utils/parse-id.js';
import { ApprovalService } from './approval.service.js';
import { ApproveDto, QueryApprovalDto, RejectDto } from './dto/approval.dto.js';

@ApiTags('审批')
@Controller('approvals')
export class ApprovalController {
  constructor(private readonly approvalService: ApprovalService) {}

  @Get('tasks')
  @ApiOperation({ summary: '我的待办', description: '默认只返回待审批的任务' })
  async myTasks(
    @CurrentMember() me: MemberContext,
    @Query() query: QueryApprovalDto,
  ): Promise<PageResult<ApprovalTaskListItemVo>> {
    return this.approvalService.myTasks(me, query) as Promise<PageResult<ApprovalTaskListItemVo>>;
  }

  @Get('applications')
  @ApiOperation({ summary: '我提交的申请' })
  async myApplications(
    @CurrentMember() me: MemberContext,
    @Query() query: QueryApprovalDto,
  ): Promise<PageResult<ApprovalInstanceVo>> {
    return this.approvalService.myApplications(me, query);
  }

  @Get(':id')
  @ApiOperation({ summary: '审批实例详情', description: '含每个节点的审批人与处理结果' })
  async detail(
    @CurrentMember() me: MemberContext,
    @Param('id') id: string,
  ): Promise<ApprovalInstanceVo> {
    return this.approvalService.detail(me, parseId(id));
  }

  @Post('tasks/:id/approve')
  @RequirePerm('approval:approve')
  @ApiOperation({ summary: '同意' })
  async approve(
    @CurrentMember() me: MemberContext,
    @Param('id') id: string,
    @Body() dto: ApproveDto,
  ): Promise<{ finished: boolean; status: number }> {
    return this.approvalService.approve(me, parseId(id), dto.opinion);
  }

  @Post('tasks/:id/reject')
  @RequirePerm('approval:approve')
  @ApiOperation({ summary: '驳回', description: '任一节点驳回即整单终止，必须填写意见' })
  async reject(
    @CurrentMember() me: MemberContext,
    @Param('id') id: string,
    @Body() dto: RejectDto,
  ): Promise<{ finished: boolean; status: number }> {
    return this.approvalService.reject(me, parseId(id), dto.opinion);
  }

  @Post(':id/revoke')
  @ApiOperation({ summary: '撤销申请', description: '只有申请人本人可以撤销在途的申请' })
  async revoke(@CurrentMember() me: MemberContext, @Param('id') id: string): Promise<null> {
    await this.approvalService.revoke(me, parseId(id));
    return null;
  }
}
