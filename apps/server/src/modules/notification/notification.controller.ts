import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { NotificationInboxVo } from '@club/shared';
import { CurrentMember } from '../../common/decorators/current-member.decorator.js';
import type { MemberContext } from '../../common/types/member-context.js';
import { parseId } from '../../common/utils/parse-id.js';
import { NotificationService } from './notification.service.js';

@ApiTags('通知')
@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  @ApiQuery({ name: 'onlyUnread', required: false, type: Boolean })
  @ApiOperation({ summary: '我的收件箱', description: '目前只做站内信，不接邮件与群机器人' })
  async inbox(
    @CurrentMember() me: MemberContext,
    @Query('onlyUnread') onlyUnread?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ): Promise<NotificationInboxVo> {
    const options: { onlyUnread?: boolean; page?: number; pageSize?: number } = {
      onlyUnread: onlyUnread === 'true' || onlyUnread === '1',
    };
    if (page !== undefined) options.page = Number.parseInt(page, 10);
    if (pageSize !== undefined) options.pageSize = Number.parseInt(pageSize, 10);
    return this.notificationService.inbox(me, options);
  }

  @Post(':id/read')
  @ApiOperation({ summary: '标记已读' })
  async markRead(@CurrentMember() me: MemberContext, @Param('id') id: string): Promise<null> {
    await this.notificationService.markRead(me, parseId(id));
    return null;
  }

  @Post('read-all')
  @ApiOperation({ summary: '全部标记已读' })
  async markAllRead(@CurrentMember() me: MemberContext): Promise<{ count: number }> {
    return this.notificationService.markAllRead(me);
  }
}
