import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('基础')
@Controller()
export class AppController {
  @Get('health')
  @ApiOperation({ summary: '健康检查' })
  health(): { status: string; uptime: number } {
    return { status: 'up', uptime: Math.floor(process.uptime()) };
  }
}
