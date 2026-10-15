/**
 * 场地与预约。
 *
 * 时间冲突用**区间重叠**判定：`start1 < end2 && start2 < end1`。
 * 唯一索引覆盖不到区间判断，必须在事务里 `SELECT ... FOR UPDATE` 锁住场地行，
 * 否则两个人同时约同一时段都会通过（开发文档 6.5 节点名的场景）。
 */
import { Injectable } from '@nestjs/common';
import {
  BookingStatus,
  BOOKING_STATUS_LABEL,
  BLOCKING_BOOKING_STATUSES,
  ErrorCode,
  normalizePage,
  skipOf,
  type BookingQuery,
  type CreateBookingDto,
  type VenueBookingVo,
  type VenueQuery,
  type VenueVo,
} from '@club/shared';
import { BizException } from '../../common/exceptions/biz.exception.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import type { MemberContext } from '../../common/types/member-context.js';
import { parseId } from '../../common/utils/parse-id.js';

@Injectable()
export class VenueService {
  constructor(private readonly prisma: PrismaService) {}

  async venues(me: MemberContext, query: VenueQuery): Promise<{ list: VenueVo[]; total: number }> {
    const where: Record<string, unknown> = { clubId: me.clubId };
    if (query.keyword !== undefined && query.keyword !== '') {
      where.name = { contains: query.keyword.trim() };
    }

    const rows = await this.prisma.client.venue.findMany({
      where,
      orderBy: { id: 'asc' },
      include: { _count: { select: { bookings: true } } },
    });

    return {
      list: rows.map((row) => ({
        id: row.id.toString(),
        name: row.name,
        location: row.location,
        capacity: row.capacity,
        openWeekdays: row.openWeekdays,
        openTime: row.openTime,
        closeTime: row.closeTime,
        status: row.status,
        bookingCount: row._count.bookings,
      })),
      total: rows.length,
    };
  }

  async createVenue(
    me: MemberContext,
    dto: { name: string; location?: string; capacity?: number; openTime?: string; closeTime?: string },
  ): Promise<VenueVo> {
    const exists = await this.prisma.client.venue.findFirst({
      where: { clubId: me.clubId, name: dto.name },
      select: { id: true },
    });
    if (exists !== null) throw new BizException(ErrorCode.DUPLICATE_RECORD, `场地「${dto.name}」已存在`);

    const row = await this.prisma.client.venue.create({
      data: {
        clubId: me.clubId,
        name: dto.name,
        location: dto.location ?? null,
        capacity: dto.capacity ?? 0,
        openTime: dto.openTime ?? null,
        closeTime: dto.closeTime ?? null,
        status: 1,
      },
      include: { _count: { select: { bookings: true } } },
    });
    return {
      id: row.id.toString(),
      name: row.name,
      location: row.location,
      capacity: row.capacity,
      openWeekdays: row.openWeekdays,
      openTime: row.openTime,
      closeTime: row.closeTime,
      status: row.status,
      bookingCount: 0,
    };
  }

  /**
   * 预约场地。冲突判定与写入在同一事务、同一把行锁内完成。
   * 待审批的预约也占位，否则会「先到先得变成后审先得」。
   */
  async book(me: MemberContext, dto: CreateBookingDto): Promise<VenueBookingVo> {
    if (dto.endTime <= dto.startTime) {
      throw new BizException(ErrorCode.PARAM_INVALID, '结束时间必须晚于开始时间');
    }
    const venueId = parseId(dto.venueId);
    const bookDate = new Date(dto.bookDate);

    const created = await this.prisma.transaction(async (tx) => {
      // 锁住场地行，把「查冲突 + 插入」串行化
      await tx.$queryRaw`SELECT id FROM venue WHERE id = ${venueId} FOR UPDATE`;

      const conflicts = await tx.venueBooking.findMany({
        where: {
          venueId,
          bookDate,
          status: { in: [...BLOCKING_BOOKING_STATUSES] },
        },
        select: { id: true, startTime: true, endTime: true, member: { select: { user: { select: { realName: true } } } } },
      });

      const overlapped = conflicts.find(
        (row) => dto.startTime < row.endTime && row.startTime < dto.endTime,
      );
      if (overlapped !== undefined) {
        throw new BizException(
          ErrorCode.VENUE_TIME_CONFLICT,
          `${dto.bookDate} ${overlapped.startTime}-${overlapped.endTime} 已被 ${overlapped.member.user.realName} 占用`,
        );
      }

      return tx.venueBooking.create({
        data: {
          clubId: me.clubId,
          venueId,
          memberId: me.memberId,
          activityId:
            dto.activityId === undefined || dto.activityId === null || dto.activityId === ''
              ? null
              : parseId(dto.activityId),
          bookDate,
          startTime: dto.startTime,
          endTime: dto.endTime,
          purpose: dto.purpose ?? null,
          status: BookingStatus.PENDING,
        },
      });
    });

    return this.loadBooking(me, created.id);
  }

  async bookings(
    me: MemberContext,
    query: BookingQuery,
  ): Promise<{ list: VenueBookingVo[]; total: number; page: number; pageSize: number }> {
    const { page, pageSize } = normalizePage(query);
    const where: Record<string, unknown> = { clubId: me.clubId };
    if (query.venueId !== undefined && query.venueId !== '') where.venueId = parseId(query.venueId);
    if (query.status !== undefined) where.status = query.status;
    if (query.dateFrom !== undefined || query.dateTo !== undefined) {
      where.bookDate = {
        ...(query.dateFrom !== undefined && query.dateFrom !== '' ? { gte: new Date(query.dateFrom) } : {}),
        ...(query.dateTo !== undefined && query.dateTo !== '' ? { lte: new Date(query.dateTo) } : {}),
      };
    }

    const [total, rows] = await Promise.all([
      this.prisma.client.venueBooking.count({ where }),
      this.prisma.client.venueBooking.findMany({
        where,
        orderBy: [{ bookDate: 'desc' }, { startTime: 'asc' }],
        skip: skipOf(page, pageSize),
        take: pageSize,
        include: {
          venue: { select: { name: true } },
          member: { select: { user: { select: { realName: true } } } },
          approver: { select: { user: { select: { realName: true } } } },
        },
      }),
    ]);

    return { list: rows.map((row) => toBookingVo(row as never)), total, page, pageSize };
  }

  /** 审批预约。通过前再查一次冲突——期间可能被别人占了。 */
  async audit(me: MemberContext, id: bigint, approved: boolean): Promise<VenueBookingVo> {
    const booking = await this.prisma.client.venueBooking.findFirst({
      where: { id, clubId: me.clubId },
      select: { id: true, venueId: true, bookDate: true, startTime: true, endTime: true, status: true },
    });
    if (booking === null) throw new BizException(ErrorCode.NOT_FOUND, '预约记录不存在');
    if (booking.status !== BookingStatus.PENDING) {
      throw new BizException(ErrorCode.STATE_NOT_ALLOWED, '该预约已经处理过了');
    }

    await this.prisma.transaction(async (tx) => {
      if (approved) {
        await tx.$queryRaw`SELECT id FROM venue WHERE id = ${booking.venueId} FOR UPDATE`;
        const conflicts = await tx.venueBooking.findMany({
          where: {
            venueId: booking.venueId,
            bookDate: booking.bookDate,
            status: BookingStatus.APPROVED,
          },
          select: { startTime: true, endTime: true },
        });
        const overlapped = conflicts.find(
          (row) => booking.startTime < row.endTime && row.startTime < booking.endTime,
        );
        if (overlapped !== undefined) {
          throw new BizException(
            ErrorCode.VENUE_TIME_CONFLICT,
            `该时段已被另一条已通过的预约占用（${overlapped.startTime}-${overlapped.endTime}）`,
          );
        }
      }

      await tx.venueBooking.update({
        where: { id },
        data: {
          status: approved ? BookingStatus.APPROVED : BookingStatus.REJECTED,
          approverMemberId: me.memberId,
        },
      });
    });

    return this.loadBooking(me, id);
  }

  async cancel(me: MemberContext, id: bigint): Promise<void> {
    const booking = await this.prisma.client.venueBooking.findFirst({
      where: { id, clubId: me.clubId },
      select: { id: true, memberId: true, status: true },
    });
    if (booking === null) throw new BizException(ErrorCode.NOT_FOUND, '预约记录不存在');
    if (booking.memberId !== me.memberId) {
      throw new BizException(ErrorCode.FORBIDDEN, '只能取消自己的预约');
    }
    if (booking.status === BookingStatus.CANCELLED) return;

    await this.prisma.client.venueBooking.update({
      where: { id },
      data: { status: BookingStatus.CANCELLED },
    });
  }

  private async loadBooking(me: MemberContext, id: bigint): Promise<VenueBookingVo> {
    const row = await this.prisma.client.venueBooking.findFirstOrThrow({
      where: { id },
      include: {
        venue: { select: { name: true } },
        member: { select: { user: { select: { realName: true } } } },
        approver: { select: { user: { select: { realName: true } } } },
      },
    });
    void me;
    return toBookingVo(row as never);
  }
}

interface BookingRow {
  id: bigint;
  venueId: bigint;
  activityId: bigint | null;
  memberId: bigint;
  bookDate: Date;
  startTime: string;
  endTime: string;
  purpose: string | null;
  status: number;
  venue: { name: string };
  member: { user: { realName: string } };
  approver: { user: { realName: string } } | null;
}

function toBookingVo(row: BookingRow): VenueBookingVo {
  return {
    id: row.id.toString(),
    venueId: row.venueId.toString(),
    venueName: row.venue.name,
    activityId: row.activityId?.toString() ?? null,
    memberId: row.memberId.toString(),
    memberName: row.member.user.realName,
    bookDate: row.bookDate.toISOString().slice(0, 10),
    startTime: row.startTime,
    endTime: row.endTime,
    purpose: row.purpose,
    status: row.status,
    statusLabel: BOOKING_STATUS_LABEL[row.status as BookingStatus] ?? String(row.status),
    approverName: row.approver?.user.realName ?? null,
  };
}
