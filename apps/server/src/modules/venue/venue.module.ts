import { Body, Controller, Get, Module, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { CreateBookingDto, VenueBookingVo, VenueVo } from '@club/shared';
import { CurrentMember } from '../../common/decorators/current-member.decorator.js';
import { RequirePerm } from '../../common/decorators/require-perm.decorator.js';
import type { MemberContext } from '../../common/types/member-context.js';
import { parseId } from '../../common/utils/parse-id.js';
import { BookingQueryDto, VenueQueryDto } from '../ops-query.dto.js';
import { VenueService } from './venue.service.js';

@ApiTags('场地')
@Controller('venues')
export class VenueController {
  constructor(private readonly venueService: VenueService) {}

  @Get()
  @RequirePerm('venue:read')
  @ApiOperation({ summary: '场地列表' })
  async list(
    @CurrentMember() me: MemberContext,
    @Query() query: VenueQueryDto,
  ): Promise<{ list: VenueVo[]; total: number }> {
    return this.venueService.venues(me, query);
  }

  @Post()
  @RequirePerm('venue:create')
  @ApiOperation({ summary: '新增场地' })
  async create(
    @CurrentMember() me: MemberContext,
    @Body() dto: { name: string; location?: string; capacity?: number; openTime?: string; closeTime?: string },
  ): Promise<VenueVo> {
    return this.venueService.createVenue(me, dto);
  }

  @Get('bookings')
  @RequirePerm('venue:read')
  @ApiOperation({ summary: '预约记录' })
  async bookings(
    @CurrentMember() me: MemberContext,
    @Query() query: BookingQueryDto,
  ): Promise<{ list: VenueBookingVo[]; total: number; page: number; pageSize: number }> {
    return this.venueService.bookings(me, query);
  }

  @Post('bookings')
  @RequirePerm('venue:create')
  @ApiOperation({
    summary: '预约场地',
    description: '时段冲突在事务内用 SELECT ... FOR UPDATE 锁行判定，并发下不会双重占用。',
  })
  async book(
    @CurrentMember() me: MemberContext,
    @Body() dto: CreateBookingDto,
  ): Promise<VenueBookingVo> {
    return this.venueService.book(me, dto);
  }

  @Post('bookings/:id/audit')
  @RequirePerm('venue:approve')
  @ApiOperation({ summary: '审批预约', description: '通过前会再查一次冲突' })
  async audit(
    @CurrentMember() me: MemberContext,
    @Param('id') id: string,
    @Body() dto: { approved: boolean },
  ): Promise<VenueBookingVo> {
    return this.venueService.audit(me, parseId(id), dto.approved);
  }

  @Post('bookings/:id/cancel')
  @ApiOperation({ summary: '取消预约' })
  async cancel(@CurrentMember() me: MemberContext, @Param('id') id: string): Promise<null> {
    await this.venueService.cancel(me, parseId(id));
    return null;
  }
}

@Module({
  controllers: [VenueController],
  providers: [VenueService],
  exports: [VenueService],
})
export class VenueModule {}
