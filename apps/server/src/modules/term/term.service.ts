/**
 * 届次。每社团同一时刻只能有一个 isCurrent 为 true 的届次。
 * 归档的届次不允许再改成员归属——那会污染历史档案。
 */
import { Injectable } from '@nestjs/common';
import { EnableStatus, ErrorCode, TermStatus, TERM_STATUS_LABEL, type TermVo } from '@club/shared';
import { BizException } from '../../common/exceptions/biz.exception.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import type { MemberContext } from '../../common/types/member-context.js';
import { CreateTermDto, UpdateTermDto } from './dto/term.dto.js';

interface TermRow {
  id: bigint;
  name: string;
  startDate: Date;
  endDate: Date;
  isCurrent: boolean;
  status: number;
  _count: { members: number };
}

@Injectable()
export class TermService {
  constructor(private readonly prisma: PrismaService) {}

  async list(me: MemberContext): Promise<TermVo[]> {
    const rows = await this.prisma.client.term.findMany({
      where: { clubId: me.clubId },
      orderBy: [{ isCurrent: 'desc' }, { startDate: 'desc' }],
      include: { _count: { select: { members: true } } },
    });
    return (rows as TermRow[]).map(toTermVo);
  }

  async create(me: MemberContext, dto: CreateTermDto): Promise<TermVo> {
    const start = new Date(dto.startDate);
    const end = new Date(dto.endDate);
    if (end <= start) {
      throw new BizException(ErrorCode.PARAM_INVALID, '结束日期必须晚于开始日期');
    }

    const duplicate = await this.prisma.client.term.findFirst({
      where: { clubId: me.clubId, name: dto.name },
      select: { id: true },
    });
    if (duplicate !== null) {
      throw new BizException(ErrorCode.DUPLICATE_RECORD, `届次「${dto.name}」已存在`);
    }

    const row = await this.prisma.client.term.create({
      data: {
        clubId: me.clubId,
        name: dto.name,
        startDate: start,
        endDate: end,
        // 新建的届次默认不是当前届次，要显式切换
        isCurrent: false,
        status: TermStatus.ACTIVE,
        createdBy: me.userId,
      },
      include: { _count: { select: { members: true } } },
    });
    return toTermVo(row as TermRow);
  }

  async update(me: MemberContext, id: bigint, dto: UpdateTermDto): Promise<TermVo> {
    const term = await this.findOwned(me, id);
    if (term.isCurrent && dto.status === TermStatus.ARCHIVED) {
      throw new BizException(
        ErrorCode.BUSINESS_RULE_VIOLATED,
        '当前届次不能直接归档，请先把另一个届次切为当前届次',
      );
    }

    const row = await this.prisma.client.term.update({
      where: { id },
      data: {
        name: dto.name,
        startDate: dto.startDate === undefined ? undefined : new Date(dto.startDate),
        endDate: dto.endDate === undefined ? undefined : new Date(dto.endDate),
        status: dto.status,
        updatedBy: me.userId,
      },
      include: { _count: { select: { members: true } } },
    });
    return toTermVo(row as TermRow);
  }

  /** 切换当前届次。同一社团只能有一个，先全部清掉再置位，放在事务里。 */
  async setCurrent(me: MemberContext, id: bigint): Promise<TermVo> {
    const term = await this.findOwned(me, id);
    if (term.status === TermStatus.ARCHIVED) {
      throw new BizException(ErrorCode.BUSINESS_RULE_VIOLATED, '已归档的届次不能设为当前届次');
    }

    await this.prisma.transaction(async (tx) => {
      await tx.term.updateMany({
        where: { clubId: me.clubId, isCurrent: true },
        data: { isCurrent: false },
      });
      await tx.term.update({ where: { id }, data: { isCurrent: true, updatedBy: me.userId } });
    });

    const row = await this.prisma.client.term.findFirstOrThrow({
      where: { id },
      include: { _count: { select: { members: true } } },
    });
    return toTermVo(row as TermRow);
  }

  async remove(me: MemberContext, id: bigint): Promise<void> {
    const term = await this.findOwned(me, id);
    if (term.isCurrent) {
      throw new BizException(ErrorCode.BUSINESS_RULE_VIOLATED, '当前届次不允许删除');
    }

    const memberCount = await this.prisma.client.member.count({ where: { termId: id } });
    if (memberCount > 0) {
      throw new BizException(
        ErrorCode.BUSINESS_RULE_VIOLATED,
        `该届次下还有 ${memberCount} 名成员记录，请先归档处理`,
      );
    }
    await this.prisma.client.term.delete({ where: { id } });
  }

  /** 当前届次，成员新增时默认挂到这上面 */
  async currentTermId(me: MemberContext): Promise<bigint> {
    const term = await this.prisma.client.term.findFirst({
      where: { clubId: me.clubId, isCurrent: true, status: EnableStatus.ENABLED },
      select: { id: true },
    });
    if (term === null) {
      throw new BizException(ErrorCode.NOT_FOUND, '当前社团还没有设置当前届次');
    }
    return term.id;
  }

  private async findOwned(
    me: MemberContext,
    id: bigint,
  ): Promise<{ id: bigint; isCurrent: boolean; status: number }> {
    const row = await this.prisma.client.term.findFirst({
      where: { id, clubId: me.clubId },
      select: { id: true, isCurrent: true, status: true },
    });
    if (row === null) throw new BizException(ErrorCode.NOT_FOUND, '届次不存在');
    return row;
  }
}

function toTermVo(row: TermRow): TermVo {
  return {
    id: row.id.toString(),
    name: row.name,
    startDate: row.startDate.toISOString().slice(0, 10),
    endDate: row.endDate.toISOString().slice(0, 10),
    isCurrent: row.isCurrent,
    status: row.status,
    statusLabel: TERM_STATUS_LABEL[row.status as TermStatus] ?? String(row.status),
    memberCount: row._count.members,
  };
}
