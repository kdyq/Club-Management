import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '@club/shared';

export class QueryMemberDto {
  @ApiPropertyOptional({ description: '页码', default: DEFAULT_PAGE })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ description: '每页条数', default: DEFAULT_PAGE_SIZE, maximum: MAX_PAGE_SIZE })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number;

  @ApiPropertyOptional({ description: '按姓名 / 学号 / 成员编号模糊搜索' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  keyword?: string;

  @ApiPropertyOptional({ description: '部门 id' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  deptId?: string;

  @ApiPropertyOptional({ description: '成员状态，见 MemberStatus' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  status?: number;

  @ApiPropertyOptional({ description: '职务，见 MemberPosition' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  position?: number;

  @ApiPropertyOptional({ description: '排序字段', enum: ['joinDate', 'memberNo', 'totalPoints'] })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  sortBy?: string;

  @ApiPropertyOptional({ description: '排序方向', enum: ['asc', 'desc'] })
  @IsOptional()
  @IsString()
  @MaxLength(4)
  sortOrder?: 'asc' | 'desc';
}
