import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
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

export class CreateAccountDto {
  @ApiProperty({ example: '社团经费账户' })
  @IsString()
  @MinLength(2)
  @MaxLength(32)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(32)
  accountNo?: string;

  @ApiPropertyOptional({ description: '期初余额', default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  initialAmount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isDefault?: boolean;
}

export class CreateFundCategoryDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(32)
  name!: string;

  @ApiProperty({ description: '1 收入科目 / 2 支出科目' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2)
  type!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  parentId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sort?: number;
}

export class QueryTransactionDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  pageSize?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  keyword?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  accountId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  categoryId?: string;

  @ApiPropertyOptional({ description: '1 收入 / 2 支出' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  type?: number;

  @ApiPropertyOptional({ description: '1 待审批 / 2 已入账 / 3 已作废' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  status?: number;

  @ApiPropertyOptional({ example: '2026-09-01' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  dateFrom?: string;

  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  dateTo?: string;
}

export class CreateTransactionDto {
  @ApiProperty()
  @IsString()
  @MaxLength(20)
  accountId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  categoryId?: string | null;

  @ApiProperty({ description: '1 收入 / 2 支出' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2)
  type!: number;

  @ApiProperty({ description: '金额，永远传正数；方向由 type 决定' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount!: number;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(128)
  title!: string;

  @ApiProperty({ example: '2026-11-17' })
  @IsDateString()
  occurredAt!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  handlerMemberId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;

  @ApiPropertyOptional({ description: 'true 则先提交审批，通过后才入账', default: false })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  needApproval?: boolean;

  @ApiPropertyOptional({ description: '凭证文件 id 列表', type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  voucherFileIds?: string[];
}

export class VoidTransactionDto {
  @ApiProperty({ description: '作废原因，必填' })
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  reason!: string;
}

export class CreateBudgetDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(64)
  name!: string;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  categoryId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  activityId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  periodStart?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  periodEnd?: string;
}

export class QueryBudgetDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  pageSize?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  keyword?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  status?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  activityId?: string;
}

export class CreateFeeStandardDto {
  @ApiProperty({ example: '2026-2027 学年会费' })
  @IsString()
  @MinLength(2)
  @MaxLength(64)
  name!: string;

  @ApiProperty({ example: 50 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount!: number;

  @ApiProperty({ example: '2026-10-31' })
  @IsDateString()
  dueDate!: string;

  @ApiPropertyOptional({ description: '不传则用当前届次' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  termId?: string;

  @ApiPropertyOptional({ description: '1 全体 / 2 部门 / 3 指定成员', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3)
  targetType?: number;

  @ApiPropertyOptional({ description: 'targetType 为 2/3 时的部门或成员 id 列表', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  targetIds?: string[];
}

export class QueryFeeDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  pageSize?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  feeStandardId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  memberId?: string;

  @ApiPropertyOptional({ description: '1 未缴 / 2 部分缴纳 / 3 已缴清 / 4 已减免' })
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

export class PayFeeDto {
  @ApiProperty({ description: '本次缴纳金额' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  paidAmount!: number;

  @ApiProperty({ description: '1 现金 / 2 微信 / 3 支付宝 / 4 银行转账' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(4)
  payMethod!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  voucherFileId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  remark?: string;

  @ApiPropertyOptional({ description: '是否同时派生一笔收入流水，默认 true', default: true })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  createTransaction?: boolean;
}

export class WaiveFeeDto {
  @ApiProperty({ description: '减免原因' })
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  reason!: string;
}
