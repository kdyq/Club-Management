/**
 * 站内信通知。
 *
 * 本项目**只做站内信**（2026-10-15 确认）：不接 SMTP、不接企业微信/钉钉群机器人。
 * `channelJson` 字段保留下来，将来接其它渠道时改这里即可，业务代码不用动。
 *
 * 幂等：同一次业务事件（bizType + bizId + 接收人）只发一条，
 * 定时任务重复跑不会给同一个人反复推同一条通知。
 */
import { Injectable, Logger } from '@nestjs/common';
import { NotificationType } from '@club/shared';
import { PrismaService } from '../../common/prisma/prisma.service.js';

export interface NotifyInput {
  clubId: bigint;
  title: string;
  content: string;
  type: NotificationType;
  /** 业务幂等键。传了就按它去重 */
  bizType?: string;
  bizId?: bigint;
  senderMemberId?: bigint | null;
  /** 接收人的 userId 列表 */
  receiverUserIds: bigint[];
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 发一条站内信。返回实际创建的接收人数量。
   * 已存在同样 bizType + bizId 的通知时直接跳过（幂等）。
   */
  async send(input: NotifyInput): Promise<{ notificationId: string | null; receivers: number }> {
    if (input.receiverUserIds.length === 0) {
      return { notificationId: null, receivers: 0 };
    }

    if (input.bizType !== undefined && input.bizId !== undefined) {
      const exists = await this.prisma.client.notification.findFirst({
        where: { clubId: input.clubId, bizType: input.bizType, bizId: input.bizId },
        select: { id: true },
      });
      if (exists !== null) {
        return { notificationId: exists.id.toString(), receivers: 0 };
      }
    }

    const senderUserId = await this.resolveSenderUserId(input.clubId, input.senderMemberId ?? null);

    const created = await this.prisma.client.notification.create({
      data: {
        clubId: input.clubId,
        title: input.title,
        content: input.content,
        type: input.type,
        bizType: input.bizType ?? null,
        bizId: input.bizId ?? null,
        senderId: senderUserId,
        // 目前只开站内信这一个渠道
        channelJson: { inbox: true, email: false, wecom: false, dingtalk: false } as never,
        sendTime: new Date(),
        status: 1,
      },
    });

    await this.prisma.client.notificationReceiver.createMany({
      data: [...new Set(input.receiverUserIds.map((id) => id.toString()))].map((id) => ({
        notificationId: created.id,
        receiverUserId: BigInt(id),
      })),
      skipDuplicates: true,
    });

    this.logger.log(`站内信《${input.title}》已发给 ${input.receiverUserIds.length} 人`);
    return { notificationId: created.id.toString(), receivers: input.receiverUserIds.length };
  }

  /** 我的收件箱 */
  async inbox(
    me: { userId: bigint },
    options: { page?: number; pageSize?: number; onlyUnread?: boolean } = {},
  ): Promise<{
    list: {
      id: string;
      title: string;
      content: string;
      type: number;
      isRead: boolean;
      createdAt: string;
    }[];
    total: number;
    unread: number;
  }> {
    const page = options.page ?? 1;
    const pageSize = options.pageSize ?? 20;

    const where = {
      receiverUserId: me.userId,
      isDeleted: false,
      ...(options.onlyUnread === true ? { isRead: false } : {}),
    };

    const [total, unread, rows] = await Promise.all([
      this.prisma.client.notificationReceiver.count({ where }),
      this.prisma.client.notificationReceiver.count({
        where: { receiverUserId: me.userId, isDeleted: false, isRead: false },
      }),
      this.prisma.client.notificationReceiver.findMany({
        where,
        orderBy: { id: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          notification: {
            select: { id: true, title: true, content: true, type: true, createdAt: true },
          },
        },
      }),
    ]);

    return {
      list: rows
        .filter((row) => row.notification !== null)
        .map((row) => ({
          id: row.notification.id.toString(),
          title: row.notification.title,
          content: row.notification.content,
          type: row.notification.type,
          isRead: row.isRead,
          createdAt: row.notification.createdAt.toISOString(),
        })),
      total,
      unread,
    };
  }

  async markRead(me: { userId: bigint }, notificationId: bigint): Promise<void> {
    await this.prisma.client.notificationReceiver.updateMany({
      where: { notificationId, receiverUserId: me.userId },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async markAllRead(me: { userId: bigint }): Promise<{ count: number }> {
    const result = await this.prisma.client.notificationReceiver.updateMany({
      where: { receiverUserId: me.userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
    return { count: result.count };
  }

  /** senderId 在 schema 里指向 user，而业务侧拿到的通常是 member，这里转一次 */
  private async resolveSenderUserId(
    clubId: bigint,
    memberId: bigint | null,
  ): Promise<bigint | null> {
    if (memberId === null) return null;
    const member = await this.prisma.client.member.findFirst({
      where: { id: memberId, clubId },
      select: { userId: true },
    });
    return member?.userId ?? null;
  }
}
