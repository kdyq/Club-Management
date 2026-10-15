import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaService } from './common/prisma/prisma.service.js';

@ApiTags('基础')
@Controller()
export class AppController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('health')
  @ApiOperation({ summary: '健康检查', description: '顺带探一次数据库，确认连接可用' })
  async health(): Promise<{
    status: string;
    uptime: number;
    database: { reachable: boolean; tables: number; club: string | null };
  }> {
    let reachable = false;
    let tables = 0;
    let club: string | null = null;

    try {
      const rows = await this.prisma.client.$queryRaw<{ n: bigint }[]>`
        SELECT COUNT(*) AS n FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()
      `;
      tables = Number(rows[0]?.n ?? 0);
      const found = await this.prisma.client.club.findFirst({ select: { name: true } });
      club = found?.name ?? null;
      reachable = true;
    } catch {
      reachable = false;
    }

    return { status: 'up', uptime: Math.floor(process.uptime()), database: { reachable, tables, club } };
  }
}
