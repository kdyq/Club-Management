import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ description: '用户名，本项目里就是学号', example: '2024100101' })
  @IsString()
  @MinLength(3)
  @MaxLength(64)
  username!: string;

  @ApiProperty({ description: '密码', example: 'Xingye@2026' })
  @IsString()
  @MinLength(6)
  @MaxLength(64)
  password!: string;

  @ApiPropertyOptional({ description: '验证码 id，验证码开启时必填' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  captchaId?: string;

  @ApiPropertyOptional({ description: '验证码内容，验证码开启时必填' })
  @IsOptional()
  @IsString()
  @MaxLength(16)
  captchaCode?: string;
}
