import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type {
  ActivityCategoryVo,
  ActivityQuery,
  ActivityVo,
  CheckinTokenVo,
  CheckinVo,
  LeaveVo,
  PageResult,
  PointRecordVo,
  RegistrationQuery,
  RegistrationVo,
} from '@club/shared';
import { CurrentMember } from '../../common/decorators/current-member.decorator.js';
import { RequirePerm } from '../../common/decorators/require-perm.decorator.js';
import type { MemberContext } from '../../common/types/member-context.js';
import { parseId } from '../../common/utils/parse-id.js';
import { ActivityService } from './activity.service.js';
import { CheckinService } from './checkin.service.js';
import {
  ApplyLeaveDto,
  AuditLeaveDto,
  AuditRegistrationDto,
  CheckinDto,
  CreateActivityDto,
  CreateCategoryDto,
  IssuePointsDto,
  MakeupCheckinDto,
  QueryActivityDto,
  QueryPointRecordDto,
  QueryRegistrationDto,
  RegisterActivityDto,
  UpdateActivityDto,
  UpdateCategoryDto,
} from './dto/activity.dto.js';
import { LeaveService } from './leave.service.js';
import { RegistrationService } from './registration.service.js';

@ApiTags('活动')
@Controller('activities')
export class ActivityController {
  constructor(
    private readonly activityService: ActivityService,
    private readonly registrationService: RegistrationService,
    private readonly checkinService: CheckinService,
    private readonly leaveService: LeaveService,
  ) {}

  // ---------------------------------------------------------------------------
  // 静态路径必须排在 :id 之前，否则会被当成 id
  // ---------------------------------------------------------------------------

  @Get()
  @RequirePerm('activity:read')
  @ApiOperation({ summary: '活动列表' })
  async page(
    @CurrentMember() me: MemberContext,
    @Query() query: QueryActivityDto,
  ): Promise<PageResult<ActivityVo>> {
    return this.activityService.page(me, query as ActivityQuery);
  }

  @Get('categories')
  @RequirePerm('activity:read')
  @ApiOperation({ summary: '活动分类' })
  async categories(@CurrentMember() me: MemberContext): Promise<ActivityCategoryVo[]> {
    return this.activityService.categories(me);
  }

  @Post('categories')
  @RequirePerm('activity:create')
  @ApiOperation({ summary: '新增活动分类' })
  async createCategory(
    @CurrentMember() me: MemberContext,
    @Body() dto: CreateCategoryDto,
  ): Promise<ActivityCategoryVo> {
    return this.activityService.createCategory(me, dto);
  }

  @Put('categories/:id')
  @RequirePerm('activity:update')
  @ApiOperation({ summary: '修改活动分类' })
  async updateCategory(
    @CurrentMember() me: MemberContext,
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
  ): Promise<ActivityCategoryVo> {
    return this.activityService.updateCategory(me, parseId(id), dto);
  }

  @Get('registrations')
  @RequirePerm('activity-registration:read')
  @ApiOperation({ summary: '报名记录', description: '只返回当前登录者数据范围内活动的报名' })
  async registrations(
    @CurrentMember() me: MemberContext,
    @Query() query: QueryRegistrationDto,
  ): Promise<PageResult<RegistrationVo>> {
    return this.registrationService.page(me, query as RegistrationQuery);
  }

  @Post('registrations/:id/audit')
  @RequirePerm('activity-registration:update')
  @ApiOperation({ summary: '审核报名', description: '拒绝时必须填原因' })
  async auditRegistration(
    @CurrentMember() me: MemberContext,
    @Param('id') id: string,
    @Body() dto: AuditRegistrationDto,
  ): Promise<RegistrationVo> {
    return this.registrationService.audit(me, parseId(id), dto);
  }

  @Post('registrations/:id/cancel')
  @ApiOperation({ summary: '取消报名', description: '只能取消自己的报名' })
  async cancelRegistration(@CurrentMember() me: MemberContext, @Param('id') id: string): Promise<null> {
    await this.registrationService.cancel(me, parseId(id));
    return null;
  }

  @Get('checkins')
  @RequirePerm('checkin:read')
  @ApiOperation({ summary: '签到记录' })
  async checkins(
    @CurrentMember() me: MemberContext,
    @Query() query: QueryRegistrationDto,
  ): Promise<PageResult<CheckinVo>> {
    return this.checkinService.page(me, query as RegistrationQuery);
  }

  @Get('leaves')
  @RequirePerm('leave:read')
  @ApiOperation({ summary: '请假记录' })
  async leaves(
    @CurrentMember() me: MemberContext,
    @Query() query: QueryRegistrationDto,
  ): Promise<PageResult<LeaveVo>> {
    return this.leaveService.page(me, query as RegistrationQuery);
  }

  @Post('leaves/:id/audit')
  @RequirePerm('leave:approve')
  @ApiOperation({ summary: '审批请假' })
  async auditLeave(
    @CurrentMember() me: MemberContext,
    @Param('id') id: string,
    @Body() dto: AuditLeaveDto,
  ): Promise<LeaveVo> {
    return this.leaveService.audit(me, parseId(id), dto);
  }

  @Get('points')
  @RequirePerm('point:read')
  @ApiOperation({ summary: '积分流水' })
  async points(
    @CurrentMember() me: MemberContext,
    @Query() query: QueryPointRecordDto,
  ): Promise<PageResult<PointRecordVo>> {
    return this.activityService.pointRecords(me, query);
  }

  // ---------------------------------------------------------------------------
  // 活动本身
  // ---------------------------------------------------------------------------

  @Get(':id')
  @RequirePerm('activity:read')
  @ApiOperation({ summary: '活动详情' })
  async detail(@CurrentMember() me: MemberContext, @Param('id') id: string): Promise<ActivityVo> {
    return this.activityService.detail(me, parseId(id));
  }

  @Post()
  @RequirePerm('activity:create')
  @ApiOperation({ summary: '新增活动', description: '创建后是草稿，需再提交立项审批' })
  async create(
    @CurrentMember() me: MemberContext,
    @Body() dto: CreateActivityDto,
  ): Promise<ActivityVo> {
    return this.activityService.create(me, dto);
  }

  @Put(':id')
  @RequirePerm('activity:update')
  @ApiOperation({ summary: '修改活动' })
  async update(
    @CurrentMember() me: MemberContext,
    @Param('id') id: string,
    @Body() dto: UpdateActivityDto,
  ): Promise<ActivityVo> {
    return this.activityService.update(me, parseId(id), dto);
  }

  @Delete(':id')
  @RequirePerm('activity:delete')
  @ApiOperation({ summary: '删除活动', description: '只有草稿或已取消、且没有报名的活动能删' })
  async remove(@CurrentMember() me: MemberContext, @Param('id') id: string): Promise<null> {
    await this.activityService.remove(me, parseId(id));
    return null;
  }

  @Post(':id/submit')
  @RequirePerm('activity:update')
  @ApiOperation({
    summary: '提交立项审批',
    description: '审批通过后由审批引擎回调推进状态，业务侧不轮询。',
  })
  async submit(
    @CurrentMember() me: MemberContext,
    @Param('id') id: string,
  ): Promise<{ approvalInstanceId: string }> {
    return this.activityService.submitApproval(me, parseId(id));
  }

  @Post(':id/cancel')
  @RequirePerm('activity:update')
  @ApiOperation({ summary: '取消活动' })
  async cancel(
    @CurrentMember() me: MemberContext,
    @Param('id') id: string,
    @Body() dto: { reason?: string },
  ): Promise<ActivityVo> {
    return this.activityService.cancel(me, parseId(id), dto.reason);
  }

  @Post(':id/archive')
  @RequirePerm('activity:update')
  @ApiOperation({ summary: '归档活动', description: '必须已填写活动总结；归档后活动只读' })
  async archive(
    @CurrentMember() me: MemberContext,
    @Param('id') id: string,
    @Body() dto: { summaryReport?: string },
  ): Promise<ActivityVo> {
    return this.activityService.archive(me, parseId(id), dto.summaryReport);
  }

  @Post(':id/points')
  @RequirePerm('point:create')
  @ApiOperation({
    summary: '发放积分',
    description: '幂等：同一活动对同一成员只发一次，重复调用不会重复加分。',
  })
  async issuePoints(
    @CurrentMember() me: MemberContext,
    @Param('id') id: string,
    @Body() dto: IssuePointsDto,
  ): Promise<{ issued: number; skipped: number }> {
    return this.activityService.issuePoints(me, parseId(id), dto);
  }

  // ---------------------------------------------------------------------------
  // 报名 / 签到 / 请假（挂在具体活动下）
  // ---------------------------------------------------------------------------

  @Post(':id/register')
  @ApiOperation({
    summary: '报名活动',
    description: '名额校验在事务内用 SELECT ... FOR UPDATE 锁行，并发下不会超员。',
  })
  async register(
    @CurrentMember() me: MemberContext,
    @Param('id') id: string,
    @Body() dto: RegisterActivityDto,
  ): Promise<{ id: string; status: number; message: string }> {
    return this.registrationService.register(me, parseId(id), dto);
  }

  @Post(':id/registrations/audit-all')
  @RequirePerm('activity-registration:update')
  @ApiOperation({ summary: '一键通过全部待审报名', description: '名额满后自动停止，不会超员' })
  async auditAll(
    @CurrentMember() me: MemberContext,
    @Param('id') id: string,
  ): Promise<{ approved: number }> {
    return this.registrationService.auditAll(me, parseId(id));
  }

  @Get(':id/checkin-token')
  @RequirePerm('checkin:create')
  @ApiOperation({
    summary: '取签到二维码口令',
    description: '口令由服务端时间片计算，客户端只展示；刷新间隔见 expiresIn。',
  })
  async checkinToken(
    @CurrentMember() me: MemberContext,
    @Param('id') id: string,
  ): Promise<CheckinTokenVo> {
    return this.activityService.checkinToken(me, parseId(id));
  }

  @Post(':id/checkin')
  @ApiOperation({ summary: '签到', description: '重复签到由唯一索引兜底' })
  async checkin(
    @CurrentMember() me: MemberContext,
    @Param('id') id: string,
    @Body() dto: CheckinDto,
  ): Promise<{ checkinTime: string; status: number; statusLabel: string }> {
    return this.checkinService.checkin(me, parseId(id), dto.token);
  }

  @Post(':id/makeup')
  @RequirePerm('checkin:update')
  @ApiOperation({ summary: '管理员代签', description: '必须填写原因，会记在签到记录上' })
  async makeup(
    @CurrentMember() me: MemberContext,
    @Param('id') id: string,
    @Body() dto: MakeupCheckinDto,
  ): Promise<{ checkinTime: string }> {
    return this.checkinService.makeup(me, parseId(id), parseId(dto.memberId), dto.reason);
  }

  @Post(':id/mark-absent')
  @RequirePerm('checkin:update')
  @ApiOperation({ summary: '把未签到的人标记为缺勤' })
  async markAbsent(
    @CurrentMember() me: MemberContext,
    @Param('id') id: string,
  ): Promise<{ marked: number }> {
    return this.checkinService.markAbsent(me, parseId(id));
  }

  @Post(':id/leave')
  @ApiOperation({ summary: '提交请假' })
  async applyLeave(
    @CurrentMember() me: MemberContext,
    @Param('id') id: string,
    @Body() dto: ApplyLeaveDto,
  ): Promise<LeaveVo> {
    return this.leaveService.apply(me, parseId(id), dto.reason);
  }
}
