import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '@club/shared';

class PageBase {
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
  pageSize?: number;
}

export class QueryActivityDto extends PageBase {
  @ApiPropertyOptional({ description: '标题模糊搜索' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  keyword?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  categoryId?: string;

  @ApiPropertyOptional({ description: '活动状态，见 ActivityStatus' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  status?: number;

  @ApiPropertyOptional({ description: '只看我组织的' })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  mine?: boolean;

  @ApiPropertyOptional({ description: '只看我报名的' })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  joined?: boolean;
}

export class CreateActivityDto {
  @ApiProperty({ example: '英仙座流星雨观测' })
  @IsString()
  @MinLength(2)
  @MaxLength(128)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  categoryId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  summary?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20000)
  content?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(128)
  location?: string;

  @ApiProperty({ example: '2026-11-17T21:00:00.000Z' })
  @IsDateString()
  startTime!: string;

  @ApiProperty({ example: '2026-11-18T01:00:00.000Z' })
  @IsDateString()
  endTime!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  signupStart?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  signupEnd?: string;

  @ApiPropertyOptional({ description: '人数上限，0 表示不限', default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  capacity?: number;

  @ApiPropertyOptional({ description: '最少成行人数', default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minMembers?: number;

  @ApiPropertyOptional({ description: '报名是否需要审核', default: false })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  needAudit?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(128)
  contactInfo?: string;

  @ApiPropertyOptional({ description: '签到方式 1 二维码 / 2 口令 / 3 围栏 / 4 代签', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(4)
  checkinType?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  checkinStart?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  checkinEnd?: string;

  @ApiPropertyOptional({ description: '参与积分', default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  points?: number;

  @ApiPropertyOptional({ description: '志愿时长（小时）', default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(0)
  volunteerHours?: number;

  @ApiPropertyOptional({ description: '预算金额', default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  budgetAmount?: number;
}

export class UpdateActivityDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(128)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  categoryId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  summary?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20000)
  content?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(128)
  location?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startTime?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endTime?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  signupStart?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  signupEnd?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  capacity?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minMembers?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  needAudit?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(128)
  contactInfo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(4)
  checkinType?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  checkinStart?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  checkinEnd?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  points?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(0)
  volunteerHours?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  budgetAmount?: number;

  @ApiPropertyOptional({ description: '活动总结，归档前填写' })
  @IsOptional()
  @IsString()
  @MaxLength(20000)
  summaryReport?: string;
}

export class QueryRegistrationDto extends PageBase {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  activityId?: string;

  @ApiPropertyOptional({ description: '1 待审核 / 2 已通过 / 3 已拒绝 / 4 已取消' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  status?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(32)
  keyword?: string;
}

export class AuditRegistrationDto {
  @ApiProperty({ description: 'true 通过 / false 拒绝' })
  @Type(() => Boolean)
  @IsBoolean()
  approved!: boolean;

  @ApiPropertyOptional({ description: '拒绝时必须写原因' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  remark?: string;
}

export class RegisterActivityDto {
  @ApiPropertyOptional({ description: '备注' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  remark?: string;

  @ApiPropertyOptional({ description: '校外人员的姓名（允许访客报名时使用）' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  guestName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  guestPhone?: string;
}

export class CheckinDto {
  @ApiProperty({ description: '动态二维码 token 或数字口令' })
  @IsString()
  @MaxLength(64)
  token!: string;
}

export class MakeupCheckinDto {
  @ApiProperty({ description: '被代签的成员 id' })
  @IsString()
  @MaxLength(20)
  memberId!: string;

  @ApiProperty({ description: '代签原因' })
  @IsString()
  @MaxLength(255)
  reason!: string;
}

export class ApplyLeaveDto {
  @ApiProperty()
  @IsString()
  @MaxLength(500)
  reason!: string;
}

export class AuditLeaveDto {
  @ApiProperty()
  @Type(() => Boolean)
  @IsBoolean()
  approved!: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  remark?: string;
}

export class IssuePointsDto {
  @ApiPropertyOptional({ description: '积分值，不传则用活动配置的 points' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  points?: number;

  @ApiPropertyOptional({ description: '只发给已签到的成员，默认 true' })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  onlyCheckedIn?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;
}

export class QueryPointRecordDto extends PageBase {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  memberId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  activityId?: string;
}

export class CreateCategoryDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(32)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(16)
  color?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sort?: number;
}

export class UpdateCategoryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(32)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(16)
  color?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sort?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2)
  status?: number;
}
