import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { TermVo } from '@club/shared';
import { CurrentMember } from '../../common/decorators/current-member.decorator.js';
import { RequirePerm } from '../../common/decorators/require-perm.decorator.js';
import type { MemberContext } from '../../common/types/member-context.js';
import { parseId } from '../../common/utils/parse-id.js';
import { CreateTermDto, UpdateTermDto } from './dto/term.dto.js';
import { TermService } from './term.service.js';

@ApiTags('届次')
@Controller('terms')
export class TermController {
  constructor(private readonly termService: TermService) {}

  @Get()
  @RequirePerm('term:read')
  @ApiOperation({ summary: '届次列表' })
  async list(@CurrentMember() me: MemberContext): Promise<TermVo[]> {
    return this.termService.list(me);
  }

  @Post()
  @RequirePerm('term:create')
  @ApiOperation({ summary: '新增届次' })
  async create(@CurrentMember() me: MemberContext, @Body() dto: CreateTermDto): Promise<TermVo> {
    return this.termService.create(me, dto);
  }

  @Put(':id')
  @RequirePerm('term:update')
  @ApiOperation({ summary: '修改届次' })
  async update(
    @CurrentMember() me: MemberContext,
    @Param('id') id: string,
    @Body() dto: UpdateTermDto,
  ): Promise<TermVo> {
    return this.termService.update(me, parseId(id), dto);
  }

  @Put(':id/current')
  @RequirePerm('term:update')
  @ApiOperation({ summary: '切换为当前届次', description: '同一社团同时只能有一个当前届次' })
  async setCurrent(@CurrentMember() me: MemberContext, @Param('id') id: string): Promise<TermVo> {
    return this.termService.setCurrent(me, parseId(id));
  }

  @Delete(':id')
  @RequirePerm('term:delete')
  @ApiOperation({ summary: '删除届次', description: '当前届次与仍有成员记录的届次不允许删除' })
  async remove(@CurrentMember() me: MemberContext, @Param('id') id: string): Promise<null> {
    await this.termService.remove(me, parseId(id));
    return null;
  }
}
