/**
 * 运营模块的查询参数 DTO。
 *
 * 必须是带装饰器的 class，不能直接用 shared 里的 interface：
 * ValidationPipe 的 `enableImplicitConversion` 只对 class 生效，
 * 用 interface 时 `?status=1` 会以字符串进入 Prisma，报
 * 「Expected IntFilter or Int, provided String」。
 */
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 200;

class PageQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: DEFAULT_PAGE_SIZE, maximum: MAX_PAGE_SIZE })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  pageSize?: number;
}

export class VenueQueryDto extends PageQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  keyword?: string;
}

export class BookingQueryDto extends PageQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  venueId?: string;

  @ApiPropertyOptional({ description: '1 待审批 / 2 已通过 / 3 已驳回 / 4 已取消' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  status?: number;

  @ApiPropertyOptional({ example: '2026-10-01' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  dateFrom?: string;

  @ApiPropertyOptional({ example: '2026-10-31' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  dateTo?: string;
}

export class AssetQueryDto extends PageQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  keyword?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(32)
  category?: string;
}

export class BorrowQueryDto extends PageQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  assetId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  memberId?: string;

  @ApiPropertyOptional({ description: '1 申请中 / 2 已借出 / 3 已归还 / 4 逾期 / 5 损坏' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  status?: number;
}

export class DutyQueryDto extends PageQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  planId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  memberId?: string;

  @ApiPropertyOptional({ description: '1 待确认 / 2 已确认 / 3 已换班 / 4 已完成 / 5 缺勤' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  status?: number;

  @ApiPropertyOptional({ example: '2026-10-01' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  dateFrom?: string;

  @ApiPropertyOptional({ example: '2026-10-31' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  dateTo?: string;
}

export class AnnouncementQueryDto extends PageQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  keyword?: string;

  @ApiPropertyOptional({ description: '1 通知 / 2 公告 / 3 新闻' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  type?: number;

  @ApiPropertyOptional({ description: '1 草稿 / 2 已发布 / 3 已下架' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  publishStatus?: number;
}
