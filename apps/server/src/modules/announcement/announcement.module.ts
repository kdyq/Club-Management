/**
 * 公告。发布时给全社团发一条站内信（只做站内信，不接外部渠道）。
 * 公告走的是 notify 而不是 approval：公告不需要审批，但需要触达。
 */
import { Body, Controller, Get, Injectable, Module, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  AnnouncementStatus,
  ANNOUNCEMENT_STATUS_LABEL,
  ErrorCode,
  MemberStatus,
  NotificationType,
  normalizePage,
  skipOf,
  type AnnouncementVo,
  type CreateAnnouncementDto,
} from '@club/shared';
import { CurrentMember } from '../../common/decorators/current-member.decorator.js';
import { RequirePerm } from '../../common/decorators/require-perm.decorator.js';
import { BizException } from '../../common/exceptions/biz.exception.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import type { MemberContext } from '../../common/types/member-context.js';
import { parseId } from '../../common/utils/parse-id.js';
import { NotificationModule } from '../notification/notification.module.js';
import { NotificationService } from '../notification/notification.service.js';
import { AnnouncementQueryDto } from '../ops-query.dto.js';

const ANNOUNCEMENT_TYPE_LABEL: Record<number, string> = { 1: '通知', 2: '公告', 3: '新闻' };

@Injectable()
export class AnnouncementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notification: NotificationService,
  ) {}

  async page(
    me: MemberContext,
    query: AnnouncementQueryDto,
  ): Promise<{ list: AnnouncementVo[]; total: number; page: number; pageSize: number }> {
    const { page, pageSize } = normalizePage(query);
    const where: Record<string, unknown> = { clubId: me.clubId };
    if (query.keyword !== undefined && query.keyword !== '') {
      where.title = { contains: query.keyword.trim() };
    }
    if (query.type !== undefined) where.type = query.type;
    if (query.publishStatus !== undefined) where.publishStatus = query.publishStatus;

    const [total, rows] = await Promise.all([
      this.prisma.client.announcement.count({ where }),
      this.prisma.client.announcement.findMany({
        where,
        orderBy: [{ isTop: 'desc' }, { id: 'desc' }],
        skip: skipOf(page, pageSize),
        take: pageSize,
        include: { publisher: { select: { user: { select: { realName: true } } } } },
      }),
    ]);

    return { list: rows.map((row) => toAnnouncementVo(row as never)), total, page, pageSize };
  }

  async detail(me: MemberContext, id: bigint): Promise<AnnouncementVo> {
    const row = await this.prisma.client.announcement.findFirst({
      where: { id, clubId: me.clubId },
      include: { publisher: { select: { user: { select: { realName: true } } } } },
    });
    if (row === null) throw new BizException(ErrorCode.NOT_FOUND, '公告不存在');

    // 浏览数加一，顺便返回最新值
    await this.prisma.client.announcement.update({
      where: { id },
      data: { viewCount: { increment: 1 } },
    });
    return toAnnouncementVo({ ...row, viewCount: row.viewCount + 1 } as never);
  }

  async create(me: MemberContext, dto: CreateAnnouncementDto): Promise<AnnouncementVo> {
    const publishNow = dto.publishNow ?? true;

    const row = await this.prisma.client.announcement.create({
      data: {
        clubId: me.clubId,
        title: dto.title,
        content: dto.content,
        type: dto.type ?? 2,
        isTop: dto.isTop ?? false,
        publishStatus: publishNow ? AnnouncementStatus.PUBLISHED : AnnouncementStatus.DRAFT,
        publishAt: publishNow ? new Date() : null,
        publisherMemberId: me.memberId,
      },
      include: { publisher: { select: { user: { select: { realName: true } } } } },
    });

    if (publishNow) {
      await this.notifyAll(me, row.id, dto.title, dto.content);
    }
    return toAnnouncementVo(row as never);
  }

  async publish(me: MemberContext, id: bigint): Promise<AnnouncementVo> {
    const row = await this.prisma.client.announcement.findFirst({
      where: { id, clubId: me.clubId },
      select: { id: true, title: true, content: true, publishStatus: true },
    });
    if (row === null) throw new BizException(ErrorCode.NOT_FOUND, '公告不存在');
    if (row.publishStatus === AnnouncementStatus.PUBLISHED) {
      throw new BizException(ErrorCode.STATE_NOT_ALLOWED, '该公告已经发布过了');
    }

    const updated = await this.prisma.client.announcement.update({
      where: { id },
      data: { publishStatus: AnnouncementStatus.PUBLISHED, publishAt: new Date() },
      include: { publisher: { select: { user: { select: { realName: true } } } } },
    });

    await this.notifyAll(me, id, row.title, row.content);
    return toAnnouncementVo(updated as never);
  }

  async offline(me: MemberContext, id: bigint): Promise<AnnouncementVo> {
    const row = await this.prisma.client.announcement.findFirst({
      where: { id, clubId: me.clubId },
      select: { id: true },
    });
    if (row === null) throw new BizException(ErrorCode.NOT_FOUND, '公告不存在');

    const updated = await this.prisma.client.announcement.update({
      where: { id },
      data: { publishStatus: AnnouncementStatus.OFFLINE },
      include: { publisher: { select: { user: { select: { realName: true } } } } },
    });
    return toAnnouncementVo(updated as never);
  }

  /** 给全体在册成员发站内信。幂等键用公告 id，重复发布不会重复推送。 */
  private async notifyAll(
    me: MemberContext,
    announcementId: bigint,
    title: string,
    content: string,
  ): Promise<void> {
    const members = await this.prisma.client.member.findMany({
      where: { clubId: me.clubId, status: MemberStatus.ACTIVE },
      select: { userId: true },
    });

    await this.notification.send({
      clubId: me.clubId,
      title: `公告：${title}`,
      content: content.slice(0, 500),
      type: NotificationType.ANNOUNCEMENT,
      bizType: 'announcement',
      bizId: announcementId,
      senderMemberId: me.memberId,
      receiverUserIds: members.map((member) => member.userId),
    });
  }
}

interface AnnouncementRow {
  id: bigint;
  title: string;
  content: string;
  type: number;
  isTop: boolean;
  publishStatus: number;
  publishAt: Date | null;
  viewCount: number;
  createdAt: Date;
  publisher: { user: { realName: string } } | null;
}

function toAnnouncementVo(row: AnnouncementRow): AnnouncementVo {
  return {
    id: row.id.toString(),
    title: row.title,
    content: row.content,
    type: row.type,
    typeLabel: ANNOUNCEMENT_TYPE_LABEL[row.type] ?? String(row.type),
    isTop: row.isTop,
    publishStatus: row.publishStatus,
    publishStatusLabel:
      ANNOUNCEMENT_STATUS_LABEL[row.publishStatus as AnnouncementStatus] ?? String(row.publishStatus),
    publishAt: row.publishAt?.toISOString() ?? null,
    publisherName: row.publisher?.user.realName ?? null,
    viewCount: row.viewCount,
    createdAt: row.createdAt.toISOString(),
  };
}

@ApiTags('公告')
@Controller('announcements')
export class AnnouncementController {
  constructor(private readonly announcementService: AnnouncementService) {}

  @Get()
  @RequirePerm('announcement:read')
  @ApiOperation({ summary: '公告列表' })
  async page(
    @CurrentMember() me: MemberContext,
    @Query() query: AnnouncementQueryDto,
  ): Promise<{ list: AnnouncementVo[]; total: number; page: number; pageSize: number }> {
    return this.announcementService.page(me, query);
  }

  @Get(':id')
  @RequirePerm('announcement:read')
  @ApiOperation({ summary: '公告详情', description: '会累加浏览量' })
  async detail(@CurrentMember() me: MemberContext, @Param('id') id: string): Promise<AnnouncementVo> {
    return this.announcementService.detail(me, parseId(id));
  }

  @Post()
  @RequirePerm('announcement:create')
  @ApiOperation({ summary: '发布公告', description: '发布时给全体在册成员发站内信，幂等' })
  async create(
    @CurrentMember() me: MemberContext,
    @Body() dto: CreateAnnouncementDto,
  ): Promise<AnnouncementVo> {
    return this.announcementService.create(me, dto);
  }

  @Post(':id/publish')
  @RequirePerm('announcement:update')
  @ApiOperation({ summary: '把草稿发布出去' })
  async publish(@CurrentMember() me: MemberContext, @Param('id') id: string): Promise<AnnouncementVo> {
    return this.announcementService.publish(me, parseId(id));
  }

  @Post(':id/offline')
  @RequirePerm('announcement:update')
  @ApiOperation({ summary: '下架公告' })
  async offline(@CurrentMember() me: MemberContext, @Param('id') id: string): Promise<AnnouncementVo> {
    return this.announcementService.offline(me, parseId(id));
  }
}

@Module({
  imports: [NotificationModule],
  controllers: [AnnouncementController],
  providers: [AnnouncementService],
  exports: [AnnouncementService],
})
export class AnnouncementModule {}
