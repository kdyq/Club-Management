/**
 * 值班表：排班计划 → 班次 → 值班日志。
 * 班次状态推进：待确认 → 已确认 →（值班当天打勾）已完成；缺勤由管理员标记。
 */
import { Body, Controller, Get, Injectable, Module, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  DutyStatus,
  DUTY_STATUS_LABEL,
  ErrorCode,
  normalizePage,
  skipOf,
  type CreateDutyPlanDto,
  type CreateDutyScheduleDto,
  type DutyPlanVo,
  type DutyScheduleVo,
  type WriteDutyLogDto,
} from '@club/shared';
import { CurrentMember } from '../../common/decorators/current-member.decorator.js';
import { RequirePerm } from '../../common/decorators/require-perm.decorator.js';
import { BizException } from '../../common/exceptions/biz.exception.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import type { MemberContext } from '../../common/types/member-context.js';
import { parseId } from '../../common/utils/parse-id.js';
import { DutyQueryDto } from '../ops-query.dto.js';

const WEEKDAY_LABEL = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

@Injectable()
export class DutyService {
  constructor(private readonly prisma: PrismaService) {}

  async plans(me: MemberContext): Promise<DutyPlanVo[]> {
    const rows = await this.prisma.client.dutyPlan.findMany({
      where: { clubId: me.clubId },
      orderBy: { id: 'desc' },
      include: {
        term: { select: { name: true } },
        _count: { select: { schedules: true } },
      },
    });
    return rows.map((row) => ({
      id: row.id.toString(),
      name: row.name,
      termId: row.termId.toString(),
      termName: row.term.name,
      startDate: row.startDate.toISOString().slice(0, 10),
      endDate: row.endDate.toISOString().slice(0, 10),
      publishStatus: row.publishStatus,
      publishStatusLabel: row.publishStatus === 2 ? '已发布' : '草稿',
      scheduleCount: row._count.schedules,
    }));
  }

  async createPlan(me: MemberContext, dto: CreateDutyPlanDto): Promise<DutyPlanVo> {
    if (new Date(dto.endDate) < new Date(dto.startDate)) {
      throw new BizException(ErrorCode.PARAM_INVALID, '结束日期不能早于开始日期');
    }
    const term = await this.prisma.client.term.findFirst({
      where: { clubId: me.clubId, isCurrent: true },
      select: { id: true, name: true },
    });
    if (term === null) throw new BizException(ErrorCode.NOT_FOUND, '还没有设置当前届次');

    const row = await this.prisma.client.dutyPlan.create({
      data: {
        clubId: me.clubId,
        termId: term.id,
        name: dto.name,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        publishStatus: 1,
      },
      include: { term: { select: { name: true } }, _count: { select: { schedules: true } } },
    });
    return {
      id: row.id.toString(),
      name: row.name,
      termId: row.termId.toString(),
      termName: term.name,
      startDate: row.startDate.toISOString().slice(0, 10),
      endDate: row.endDate.toISOString().slice(0, 10),
      publishStatus: row.publishStatus,
      publishStatusLabel: '草稿',
      scheduleCount: 0,
    };
  }

  async publishPlan(me: MemberContext, id: bigint): Promise<DutyPlanVo> {
    const plan = await this.prisma.client.dutyPlan.findFirst({
      where: { id, clubId: me.clubId },
      select: { id: true },
    });
    if (plan === null) throw new BizException(ErrorCode.NOT_FOUND, '值班计划不存在');
    await this.prisma.client.dutyPlan.update({
      where: { id },
      data: { publishStatus: 2 },
    });
    const all = await this.plans(me);
    const vo = all.find((item) => item.id === id.toString());
    if (vo === undefined) throw new BizException(ErrorCode.INTERNAL_ERROR);
    return vo;
  }

  async schedules(
    me: MemberContext,
    query: DutyQueryDto,
  ): Promise<{ list: DutyScheduleVo[]; total: number; page: number; pageSize: number }> {
    const { page, pageSize } = normalizePage(query);
    const where: Record<string, unknown> = { clubId: me.clubId };
    if (query.planId !== undefined && query.planId !== '') where.planId = parseId(query.planId);
    if (query.memberId !== undefined && query.memberId !== '') where.memberId = parseId(query.memberId);
    if (query.status !== undefined) where.status = query.status;
    if (query.dateFrom !== undefined || query.dateTo !== undefined) {
      where.dutyDate = {
        ...(query.dateFrom !== undefined && query.dateFrom !== '' ? { gte: new Date(query.dateFrom) } : {}),
        ...(query.dateTo !== undefined && query.dateTo !== '' ? { lte: new Date(query.dateTo) } : {}),
      };
    }

    const [total, rows] = await Promise.all([
      this.prisma.client.dutySchedule.count({ where }),
      this.prisma.client.dutySchedule.findMany({
        where,
        orderBy: [{ dutyDate: 'asc' }, { startTime: 'asc' }],
        skip: skipOf(page, pageSize),
        take: pageSize,
        include: {
          plan: { select: { name: true } },
          member: {
            select: {
              user: { select: { realName: true } },
              dept: { select: { name: true } },
            },
          },
          _count: { select: { logs: true } },
        },
      }),
    ]);

    return { list: rows.map((row) => toScheduleVo(row as never)), total, page, pageSize };
  }

  /** 排班。同一人同一天同一时段不重复排，用「查到就拒绝」把关。 */
  async createSchedule(me: MemberContext, dto: CreateDutyScheduleDto): Promise<DutyScheduleVo> {
    if (dto.endTime <= dto.startTime) {
      throw new BizException(ErrorCode.PARAM_INVALID, '结束时间必须晚于开始时间');
    }
    const planId = parseId(dto.planId);
    const memberId = parseId(dto.memberId);
    const dutyDate = new Date(dto.dutyDate);

    const plan = await this.prisma.client.dutyPlan.findFirst({
      where: { id: planId, clubId: me.clubId },
      select: { id: true, startDate: true, endDate: true },
    });
    if (plan === null) throw new BizException(ErrorCode.NOT_FOUND, '值班计划不存在');
    if (dutyDate < plan.startDate || dutyDate > plan.endDate) {
      throw new BizException(ErrorCode.PARAM_INVALID, '排班日期不在计划的起止范围内');
    }

    const duplicate = await this.prisma.client.dutySchedule.findFirst({
      where: { planId, memberId, dutyDate, startTime: dto.startTime },
      select: { id: true },
    });
    if (duplicate !== null) {
      throw new BizException(ErrorCode.DUPLICATE_RECORD, '同一个人在这个时段已经排过班了');
    }

    const row = await this.prisma.client.dutySchedule.create({
      data: {
        planId,
        clubId: me.clubId,
        dutyDate,
        weekday: dutyDate.getDay(),
        startTime: dto.startTime,
        endTime: dto.endTime,
        location: dto.location ?? null,
        memberId,
        status: DutyStatus.PENDING,
      },
      include: {
        plan: { select: { name: true } },
        member: {
          select: { user: { select: { realName: true } }, dept: { select: { name: true } } },
        },
        _count: { select: { logs: true } },
      },
    });
    return toScheduleVo(row as never);
  }

  /** 值班人确认班次 */
  async confirm(me: MemberContext, id: bigint): Promise<DutyScheduleVo> {
    const row = await this.prisma.client.dutySchedule.findFirst({
      where: { id, clubId: me.clubId },
      select: { id: true, memberId: true, status: true },
    });
    if (row === null) throw new BizException(ErrorCode.NOT_FOUND, '班次不存在');
    if (row.memberId !== me.memberId) {
      throw new BizException(ErrorCode.FORBIDDEN, '只能确认自己的班次');
    }
    if (row.status !== DutyStatus.PENDING) {
      throw new BizException(
        ErrorCode.STATE_NOT_ALLOWED,
        `该班次已经是「${DUTY_STATUS_LABEL[row.status as DutyStatus] ?? row.status}」`,
      );
    }

    await this.prisma.client.dutySchedule.update({
      where: { id },
      data: { status: DutyStatus.CONFIRMED },
    });
    return this.loadSchedule(id);
  }

  /** 写值班日志；写完把班次置为已完成（第一次写日志时） */
  async writeLog(me: MemberContext, scheduleId: bigint, dto: WriteDutyLogDto): Promise<{ logId: string }> {
    if (dto.content.trim().length < 2) {
      throw new BizException(ErrorCode.PARAM_INVALID, '请填写值班内容');
    }
    const schedule = await this.prisma.client.dutySchedule.findFirst({
      where: { id: scheduleId, clubId: me.clubId },
      select: { id: true, memberId: true, status: true, startTime: true, endTime: true },
    });
    if (schedule === null) throw new BizException(ErrorCode.NOT_FOUND, '班次不存在');
    if (schedule.memberId !== me.memberId && !me.permissions.has('duty:update')) {
      throw new BizException(ErrorCode.FORBIDDEN, '只能给自己值班的班次写日志');
    }

    const log = await this.prisma.transaction(async (tx) => {
      const created = await tx.dutyLog.create({
        data: {
          scheduleId,
          memberId: me.memberId,
          content: dto.content,
          handoverContent: dto.handoverContent ?? null,
        },
      });
      if (schedule.status !== DutyStatus.FINISHED) {
        await tx.dutySchedule.update({
          where: { id: scheduleId },
          data: {
            status: DutyStatus.FINISHED,
            checkinTime: new Date(),
            actualMinutes: minutesBetween(schedule.startTime, schedule.endTime),
          },
        });
      }
      return created;
    });

    return { logId: log.id.toString() };
  }

  async markAbsent(me: MemberContext, id: bigint): Promise<DutyScheduleVo> {
    const row = await this.prisma.client.dutySchedule.findFirst({
      where: { id, clubId: me.clubId },
      select: { id: true, status: true },
    });
    if (row === null) throw new BizException(ErrorCode.NOT_FOUND, '班次不存在');
    await this.prisma.client.dutySchedule.update({
      where: { id },
      data: { status: DutyStatus.ABSENT },
    });
    return this.loadSchedule(id);
  }

  private async loadSchedule(id: bigint): Promise<DutyScheduleVo> {
    const row = await this.prisma.client.dutySchedule.findFirstOrThrow({
      where: { id },
      include: {
        plan: { select: { name: true } },
        member: {
          select: { user: { select: { realName: true } }, dept: { select: { name: true } } },
        },
        _count: { select: { logs: true } },
      },
    });
    return toScheduleVo(row as never);
  }
}

function minutesBetween(start: string, end: string): number {
  const [sh, sm] = start.split(':').map((n) => Number.parseInt(n, 10));
  const [eh, em] = end.split(':').map((n) => Number.parseInt(n, 10));
  return Math.max(0, (eh ?? 0) * 60 + (em ?? 0) - ((sh ?? 0) * 60 + (sm ?? 0)));
}

interface ScheduleRow {
  id: bigint;
  planId: bigint;
  dutyDate: Date;
  weekday: number;
  startTime: string;
  endTime: string;
  location: string | null;
  memberId: bigint;
  status: number;
  checkinTime: Date | null;
  actualMinutes: number | null;
  plan: { name: string };
  member: { user: { realName: string }; dept: { name: string } | null };
  _count: { logs: number };
}

function toScheduleVo(row: ScheduleRow): DutyScheduleVo {
  return {
    id: row.id.toString(),
    planId: row.planId.toString(),
    planName: row.plan.name,
    dutyDate: row.dutyDate.toISOString().slice(0, 10),
    weekday: row.weekday,
    weekdayLabel: WEEKDAY_LABEL[row.weekday] ?? '',
    startTime: row.startTime,
    endTime: row.endTime,
    location: row.location,
    memberId: row.memberId.toString(),
    memberName: row.member.user.realName,
    deptName: row.member.dept?.name ?? null,
    status: row.status,
    statusLabel: DUTY_STATUS_LABEL[row.status as DutyStatus] ?? String(row.status),
    checkinTime: row.checkinTime?.toISOString() ?? null,
    actualMinutes: row.actualMinutes,
    logCount: row._count.logs,
  };
}

@ApiTags('值班')
@Controller('duty')
export class DutyController {
  constructor(private readonly dutyService: DutyService) {}

  @Get('plans')
  @RequirePerm('duty:read')
  @ApiOperation({ summary: '值班计划' })
  async plans(@CurrentMember() me: MemberContext): Promise<DutyPlanVo[]> {
    return this.dutyService.plans(me);
  }

  @Post('plans')
  @RequirePerm('duty:create')
  @ApiOperation({ summary: '新建值班计划' })
  async createPlan(
    @CurrentMember() me: MemberContext,
    @Body() dto: CreateDutyPlanDto,
  ): Promise<DutyPlanVo> {
    return this.dutyService.createPlan(me, dto);
  }

  @Post('plans/:id/publish')
  @RequirePerm('duty:update')
  @ApiOperation({ summary: '发布值班计划' })
  async publish(@CurrentMember() me: MemberContext, @Param('id') id: string): Promise<DutyPlanVo> {
    return this.dutyService.publishPlan(me, parseId(id));
  }

  @Get('schedules')
  @RequirePerm('duty:read')
  @ApiOperation({ summary: '班次列表' })
  async schedules(
    @CurrentMember() me: MemberContext,
    @Query() query: DutyQueryDto,
  ): Promise<{ list: DutyScheduleVo[]; total: number; page: number; pageSize: number }> {
    return this.dutyService.schedules(me, query);
  }

  @Post('schedules')
  @RequirePerm('duty:create')
  @ApiOperation({ summary: '排班' })
  async createSchedule(
    @CurrentMember() me: MemberContext,
    @Body() dto: CreateDutyScheduleDto,
  ): Promise<DutyScheduleVo> {
    return this.dutyService.createSchedule(me, dto);
  }

  @Post('schedules/:id/confirm')
  @ApiOperation({ summary: '确认班次' })
  async confirm(
    @CurrentMember() me: MemberContext,
    @Param('id') id: string,
  ): Promise<DutyScheduleVo> {
    return this.dutyService.confirm(me, parseId(id));
  }

  @Post('schedules/:id/log')
  @ApiOperation({ summary: '写值班日志', description: '首次写日志会把班次置为已完成' })
  async writeLog(
    @CurrentMember() me: MemberContext,
    @Param('id') id: string,
    @Body() dto: WriteDutyLogDto,
  ): Promise<{ logId: string }> {
    return this.dutyService.writeLog(me, parseId(id), dto);
  }

  @Post('schedules/:id/absent')
  @RequirePerm('duty:update')
  @ApiOperation({ summary: '标记缺勤' })
  async markAbsent(
    @CurrentMember() me: MemberContext,
    @Param('id') id: string,
  ): Promise<DutyScheduleVo> {
    return this.dutyService.markAbsent(me, parseId(id));
  }
}

@Module({
  controllers: [DutyController],
  providers: [DutyService],
  exports: [DutyService],
})
export class DutyModule {}
