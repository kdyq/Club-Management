/**
 * 物资与借还。
 *
 * `asset.availableQty` 是**缓存字段**，准的是「总数 - 未归还借出数量」。
 * 借出与归还在事务里同时改借还记录与这个缓存，对账接口也能按借还表重算它。
 */
import { Body, Controller, Get, Injectable, Module, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  ACTIVE_BORROW_STATUSES,
  AssetBorrowStatus,
  ASSET_BORROW_STATUS_LABEL,
  ErrorCode,
  normalizePage,
  skipOf,
  type AssetBorrowVo,
  type AssetVo,
  type BorrowAssetDto,
  type CreateAssetDto,
} from '@club/shared';
import { CurrentMember } from '../../common/decorators/current-member.decorator.js';
import { RequirePerm } from '../../common/decorators/require-perm.decorator.js';
import { BizException } from '../../common/exceptions/biz.exception.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import type { MemberContext } from '../../common/types/member-context.js';
import { parseId } from '../../common/utils/parse-id.js';
import { AssetQueryDto, BorrowQueryDto } from '../ops-query.dto.js';

@Injectable()
export class AssetService {
  constructor(private readonly prisma: PrismaService) {}

  async list(me: MemberContext, query: AssetQueryDto): Promise<{ list: AssetVo[]; total: number }> {
    const where: Record<string, unknown> = { clubId: me.clubId };
    if (query.keyword !== undefined && query.keyword !== '') {
      where.name = { contains: query.keyword.trim() };
    }
    if (query.category !== undefined && query.category !== '') {
      where.category = query.category;
    }

    const rows = await this.prisma.client.asset.findMany({
      where,
      orderBy: { id: 'asc' },
    });

    // Asset 上的 keeperMemberId 是软引用（没有声明关系，避免 Member 模型继续膨胀），
    // 所以保管人姓名单独查一次并用 Map 拼上，不做 N+1 查询
    const keeperIds = rows
      .map((row) => row.keeperMemberId)
      .filter((id): id is bigint => id !== null);
    const keepers =
      keeperIds.length === 0
        ? []
        : await this.prisma.client.member.findMany({
            where: { id: { in: keeperIds } },
            select: { id: true, user: { select: { realName: true } } },
          });
    const keeperMap = new Map(keepers.map((k) => [k.id.toString(), k.user.realName]));

    return {
      list: rows.map((row) => ({
        id: row.id.toString(),
        code: row.code,
        name: row.name,
        category: row.category,
        spec: row.spec,
        unit: row.unit,
        totalQty: row.totalQty,
        availableQty: row.availableQty,
        borrowedQty: Math.max(0, row.totalQty - row.availableQty),
        location: row.location,
        keeperName:
          row.keeperMemberId === null ? null : (keeperMap.get(row.keeperMemberId.toString()) ?? null),
        status: row.status,
      })),
      total: rows.length,
    };
  }

  async create(me: MemberContext, dto: CreateAssetDto): Promise<AssetVo> {
    const totalQty = dto.totalQty ?? 1;
    const keeperMemberId =
      dto.keeperMemberId === undefined || dto.keeperMemberId === null || dto.keeperMemberId === ''
        ? null
        : parseId(dto.keeperMemberId);

    const row = await this.prisma.client.asset.create({
      data: {
        clubId: me.clubId,
        code: dto.code ?? null,
        name: dto.name,
        category: dto.category ?? null,
        spec: dto.spec ?? null,
        unit: dto.unit ?? null,
        totalQty,
        // 新入库时全部可借
        availableQty: totalQty,
        location: dto.location ?? null,
        keeperMemberId,
        status: 1,
      },
    });

    let keeperName: string | null = null;
    if (keeperMemberId !== null) {
      const keeper = await this.prisma.client.member.findFirst({
        where: { id: keeperMemberId },
        select: { user: { select: { realName: true } } },
      });
      keeperName = keeper?.user.realName ?? null;
    }

    return {
      id: row.id.toString(),
      code: row.code,
      name: row.name,
      category: row.category,
      spec: row.spec,
      unit: row.unit,
      totalQty: row.totalQty,
      availableQty: row.availableQty,
      borrowedQty: 0,
      location: row.location,
      keeperName,
      status: row.status,
    };
  }

  /** 借出：锁住物资行，避免并发借出把可借数量减成负数 */
  async borrow(me: MemberContext, dto: BorrowAssetDto): Promise<AssetBorrowVo> {
    if (dto.qty <= 0) throw new BizException(ErrorCode.PARAM_INVALID, '借出数量必须大于 0');
    const assetId = parseId(dto.assetId);

    const created = await this.prisma.transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM asset WHERE id = ${assetId} FOR UPDATE`;
      const asset = await tx.asset.findFirst({
        where: { id: assetId, clubId: me.clubId },
        select: { id: true, name: true, availableQty: true, status: true },
      });
      if (asset === null) throw new BizException(ErrorCode.NOT_FOUND, '物资不存在');
      if (asset.status !== 1) throw new BizException(ErrorCode.STATE_NOT_ALLOWED, '该物资已停用');
      if (asset.availableQty < dto.qty) {
        throw new BizException(
          ErrorCode.BUSINESS_RULE_VIOLATED,
          `可借数量不足（「${asset.name}」当前可借 ${asset.availableQty}）`,
        );
      }

      const borrow = await tx.assetBorrow.create({
        data: {
          clubId: me.clubId,
          assetId,
          memberId: me.memberId,
          qty: dto.qty,
          borrowTime: new Date(),
          expectReturnTime:
            dto.expectReturnTime === undefined || dto.expectReturnTime === ''
              ? null
              : new Date(dto.expectReturnTime),
          status: AssetBorrowStatus.BORROWED,
          remark: dto.remark ?? null,
        },
      });

      await tx.asset.update({
        where: { id: assetId },
        data: { availableQty: { decrement: dto.qty } },
      });

      return borrow;
    });

    return this.loadBorrow(created.id);
  }

  /** 归还：同样锁行，并把缓存字段加回去 */
  async returnAsset(me: MemberContext, id: bigint): Promise<AssetBorrowVo> {
    const borrow = await this.prisma.client.assetBorrow.findFirst({
      where: { id, clubId: me.clubId },
      select: { id: true, assetId: true, qty: true, memberId: true, status: true },
    });
    if (borrow === null) throw new BizException(ErrorCode.NOT_FOUND, '借还记录不存在');
    if (borrow.status === AssetBorrowStatus.RETURNED) {
      throw new BizException(ErrorCode.STATE_NOT_ALLOWED, '该记录已经归还过了');
    }
    // 本人可以还，有资产写权限的也可以代还
    if (borrow.memberId !== me.memberId && !me.permissions.has('asset:update')) {
      throw new BizException(ErrorCode.FORBIDDEN, '只能归还自己借出的物资');
    }

    await this.prisma.transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM asset WHERE id = ${borrow.assetId} FOR UPDATE`;
      await tx.assetBorrow.update({
        where: { id },
        data: { status: AssetBorrowStatus.RETURNED, actualReturnTime: new Date() },
      });
      await tx.asset.update({
        where: { id: borrow.assetId },
        data: { availableQty: { increment: borrow.qty } },
      });
    });

    return this.loadBorrow(id);
  }

  async borrows(
    me: MemberContext,
    query: BorrowQueryDto,
  ): Promise<{ list: AssetBorrowVo[]; total: number; page: number; pageSize: number }> {
    const { page, pageSize } = normalizePage(query);
    const where: Record<string, unknown> = { clubId: me.clubId };
    if (query.assetId !== undefined && query.assetId !== '') where.assetId = parseId(query.assetId);
    if (query.memberId !== undefined && query.memberId !== '') where.memberId = parseId(query.memberId);
    if (query.status !== undefined) where.status = query.status;

    const [total, rows] = await Promise.all([
      this.prisma.client.assetBorrow.count({ where }),
      this.prisma.client.assetBorrow.findMany({
        where,
        orderBy: [{ status: 'asc' }, { id: 'desc' }],
        skip: skipOf(page, pageSize),
        take: pageSize,
        include: {
          asset: { select: { name: true } },
          member: { select: { user: { select: { realName: true } } } },
        },
      }),
    ]);

    return { list: rows.map((row) => toBorrowVo(row as never)), total, page, pageSize };
  }

  private async loadBorrow(id: bigint): Promise<AssetBorrowVo> {
    const row = await this.prisma.client.assetBorrow.findFirstOrThrow({
      where: { id },
      include: {
        asset: { select: { name: true } },
        member: { select: { user: { select: { realName: true } } } },
      },
    });
    return toBorrowVo(row as never);
  }
}

interface BorrowRow {
  id: bigint;
  assetId: bigint;
  memberId: bigint;
  qty: number;
  borrowTime: Date;
  expectReturnTime: Date | null;
  actualReturnTime: Date | null;
  status: number;
  remark: string | null;
  asset: { name: string };
  member: { user: { realName: string } };
}

function toBorrowVo(row: BorrowRow): AssetBorrowVo {
  return {
    id: row.id.toString(),
    assetId: row.assetId.toString(),
    assetName: row.asset.name,
    memberId: row.memberId.toString(),
    memberName: row.member.user.realName,
    qty: row.qty,
    borrowTime: row.borrowTime.toISOString(),
    expectReturnTime: row.expectReturnTime?.toISOString() ?? null,
    actualReturnTime: row.actualReturnTime?.toISOString() ?? null,
    status: row.status,
    statusLabel: ASSET_BORROW_STATUS_LABEL[row.status as AssetBorrowStatus] ?? String(row.status),
    remark: row.remark,
  };
}

@ApiTags('物资')
@Controller('assets')
export class AssetController {
  constructor(private readonly assetService: AssetService) {}

  @Get()
  @RequirePerm('asset:read')
  @ApiOperation({ summary: '物资列表', description: '可借数量是缓存字段，以借还记录为准，可对账重算' })
  async list(
    @CurrentMember() me: MemberContext,
    @Query() query: AssetQueryDto,
  ): Promise<{ list: AssetVo[]; total: number }> {
    return this.assetService.list(me, query);
  }

  @Post()
  @RequirePerm('asset:create')
  @ApiOperation({ summary: '新增物资' })
  async create(@CurrentMember() me: MemberContext, @Body() dto: CreateAssetDto): Promise<AssetVo> {
    return this.assetService.create(me, dto);
  }

  @Get('borrows')
  @RequirePerm('asset:read')
  @ApiOperation({ summary: '借还记录' })
  async borrows(
    @CurrentMember() me: MemberContext,
    @Query() query: BorrowQueryDto,
  ): Promise<{ list: AssetBorrowVo[]; total: number; page: number; pageSize: number }> {
    return this.assetService.borrows(me, query);
  }

  @Post('borrows')
  @RequirePerm('asset:create')
  @ApiOperation({ summary: '借出物资', description: '锁行校验可借数量，并发下不会借超' })
  async borrow(
    @CurrentMember() me: MemberContext,
    @Body() dto: BorrowAssetDto,
  ): Promise<AssetBorrowVo> {
    return this.assetService.borrow(me, dto);
  }

  @Post('borrows/:id/return')
  @ApiOperation({ summary: '归还物资' })
  async returnAsset(
    @CurrentMember() me: MemberContext,
    @Param('id') id: string,
  ): Promise<AssetBorrowVo> {
    return this.assetService.returnAsset(me, parseId(id));
  }
}

@Module({
  controllers: [AssetController],
  providers: [AssetService],
  exports: [AssetService],
})
export class AssetModule {}

// 让「在借」状态集合在文件内可见，供对账复用
export { ACTIVE_BORROW_STATUSES };
