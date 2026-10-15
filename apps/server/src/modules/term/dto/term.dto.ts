import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateTermDto {
  @ApiProperty({ example: '2027-2028 学年' })
  @IsString()
  @MinLength(2)
  @MaxLength(32)
  name!: string;

  @ApiProperty({ example: '2027-09-01' })
  @IsDateString()
  startDate!: string;

  @ApiProperty({ example: '2028-08-31' })
  @IsDateString()
  endDate!: string;
}

export class UpdateTermDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(32)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ description: '1 进行中 / 2 已归档' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2)
  status?: number;
}
