import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { OverviewVo, PublicOverviewVo } from '@club/shared';
import { CurrentMember } from '../../common/decorators/current-member.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';
import type { MemberContext } from '../../common/types/member-context.js';
import { StatsService } from './stats.service.js';

@ApiTags('统计')
@Controller('stats')
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Public()
  @Get('public')
  @ApiOperation({
    summary: '登录页展示的社团规模',
    description: '无需登录。只返回规模数字，不含任何名单或明细。',
  })
  async publicOverview(): Promise<PublicOverviewVo> {
    return this.statsService.publicOverview();
  }

  @Get('overview')
  @ApiOperation({
    summary: '工作台概览',
    description: '成员数按当前登录者的数据范围统计，全社团人数作为对比基准一并返回。',
  })
  async overview(@CurrentMember() me: MemberContext): Promise<OverviewVo> {
    return this.statsService.overview(me);
  }
}
