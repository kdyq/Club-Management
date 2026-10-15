import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class CreateDepartmentDto {
  @ApiProperty({ example: '观测部' })
  @IsString()
  @MinLength(2)
  @MaxLength(32)
  name!: string;

  @ApiPropertyOptional({ description: '上级部门 id，不传表示顶级（parentId 为 NULL）' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  parentId?: string | null;

  @ApiPropertyOptional({ description: '负责人成员 id' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  leaderMemberId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sort?: number;
}

export class UpdateDepartmentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(32)
  name?: string;

  @ApiPropertyOptional({ description: '上级部门 id，传 null 表示升为顶级' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  parentId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  leaderMemberId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sort?: number;

  @ApiPropertyOptional({ description: '1 正常 / 2 停用' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2)
  status?: number;
}
