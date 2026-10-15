import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class QueryApprovalDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number;

  @ApiPropertyOptional({ description: '状态：待办 1 / 已同意 2 / 已拒绝 3 / 已超时 5' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  status?: number;
}

export class ApproveDto {
  @ApiPropertyOptional({ description: '审批意见' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  opinion?: string;
}

export class RejectDto {
  @ApiProperty({ description: '驳回必须写意见' })
  @IsString()
  @MaxLength(500)
  opinion!: string;
}
