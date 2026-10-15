import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { DepartmentNodeVo } from '@club/shared';
import { CurrentMember } from '../../common/decorators/current-member.decorator.js';
import { RequirePerm } from '../../common/decorators/require-perm.decorator.js';
import type { MemberContext } from '../../common/types/member-context.js';
import { parseId } from '../../common/utils/parse-id.js';
import { DepartmentService } from './department.service.js';
import { CreateDepartmentDto, UpdateDepartmentDto } from './dto/department.dto.js';

@ApiTags('部门')
@Controller('departments')
export class DepartmentController {
  constructor(private readonly departmentService: DepartmentService) {}

  @Get('tree')
  @RequirePerm('department:read')
  @ApiQuery({ name: 'includeDisabled', required: false, type: Boolean })
  @ApiOperation({ summary: '部门树' })
  async tree(
    @CurrentMember() me: MemberContext,
    @Query('includeDisabled') includeDisabled?: string,
  ): Promise<DepartmentNodeVo[]> {
    return this.departmentService.tree(me, includeDisabled === 'true' || includeDisabled === '1');
  }

  @Get('options')
  @RequirePerm('department:read')
  @ApiOperation({ summary: '部门扁平选项', description: '给成员筛选与表单下拉用' })
  async options(
    @CurrentMember() me: MemberContext,
  ): Promise<{ id: string; name: string; parentId: string | null }[]> {
    return this.departmentService.options(me);
  }

  @Post()
  @RequirePerm('department:create')
  @ApiOperation({ summary: '新增部门' })
  async create(
    @CurrentMember() me: MemberContext,
    @Body() dto: CreateDepartmentDto,
  ): Promise<DepartmentNodeVo> {
    return this.departmentService.create(me, dto);
  }

  @Put(':id')
  @RequirePerm('department:update')
  @ApiOperation({ summary: '修改部门', description: '改上级时会校验不能挂到自己的下级，避免成环' })
  async update(
    @CurrentMember() me: MemberContext,
    @Param('id') id: string,
    @Body() dto: UpdateDepartmentDto,
  ): Promise<DepartmentNodeVo> {
    return this.departmentService.update(me, parseId(id), dto);
  }

  @Delete(':id')
  @RequirePerm('department:delete')
  @ApiOperation({ summary: '删除部门', description: '有子部门或仍有成员时不允许删除' })
  async remove(@CurrentMember() me: MemberContext, @Param('id') id: string): Promise<null> {
    await this.departmentService.remove(me, parseId(id));
    return null;
  }
}
