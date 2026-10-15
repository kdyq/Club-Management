import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateMemberDto {
  @ApiProperty({ example: '顾行川' })
  @IsString()
  @MinLength(2)
  @MaxLength(32)
  realName!: string;

  @ApiProperty({ example: '2026100111' })
  @IsString()
  @MinLength(4)
  @MaxLength(32)
  studentNo!: string;

  @ApiPropertyOptional({ description: '0 未填 / 1 男 / 2 女', default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(2)
  gender?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(8)
  grade?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  major?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(32)
  className?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  @MaxLength(64)
  email?: string;

  @ApiPropertyOptional({ description: '部门 id' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  deptId?: string | null;

  @ApiPropertyOptional({ description: '职务 1-6，见 MemberPosition', default: 6 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(6)
  position?: number;

  @ApiPropertyOptional({ description: '是否核心成员', default: false })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isCore?: boolean;

  @ApiPropertyOptional({ description: '角色 id 列表', type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  roleIds?: string[];

  @ApiPropertyOptional({ description: '加入日期 yyyy-MM-dd' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  joinDate?: string;
}

export class UpdateMemberDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(32)
  realName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(2)
  gender?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(8)
  grade?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  major?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(32)
  className?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  @MaxLength(64)
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  deptId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(6)
  position?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isCore?: boolean;

  @ApiPropertyOptional({ description: '成员状态 1-4，见 MemberStatus' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(4)
  status?: number;

  @ApiPropertyOptional({ description: '角色 id 列表，传入即整体替换', type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  roleIds?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(10)
  leaveDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  leaveReason?: string;
}
