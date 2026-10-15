import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { DataScope, DEFAULT_PAGE, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '@club/shared';

export class QueryRoleDto {
  @ApiPropertyOptional({ default: DEFAULT_PAGE })
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
  pageSize?: number;

  @ApiPropertyOptional({ description: '角色名或编码模糊搜索' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  keyword?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  status?: number;
}

export class CreateRoleDto {
  @ApiProperty({ description: '角色名', example: '宣传部长' })
  @IsString()
  @MinLength(2)
  @MaxLength(32)
  name!: string;

  @ApiProperty({ description: '角色编码，小写字母下划线', example: 'publicity_lead' })
  @IsString()
  @MinLength(2)
  @MaxLength(32)
  code!: string;

  @ApiProperty({
    description: '数据范围 1 仅本人 / 2 本部门 / 3 本部门及以下 / 4 本社团 / 5 全部',
    enum: Object.values(DataScope).filter((v) => typeof v === 'number'),
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  dataScope!: number;

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

export class UpdateRoleDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(32)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  dataScope?: number;

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

export class AssignPermissionsDto {
  @ApiProperty({ description: '该角色应拥有的完整权限码清单', type: [String] })
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  permissionCodes!: string[];
}
