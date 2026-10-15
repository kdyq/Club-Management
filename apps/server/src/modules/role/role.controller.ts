import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { PageResult, RoleVo } from '@club/shared';
import { CurrentMember } from '../../common/decorators/current-member.decorator.js';
import { RequirePerm } from '../../common/decorators/require-perm.decorator.js';
import type { MemberContext } from '../../common/types/member-context.js';
import { parseId } from '../../common/utils/parse-id.js';
import {
  AssignPermissionsDto,
  CreateRoleDto,
  QueryRoleDto,
  UpdateRoleDto,
} from './dto/role.dto.js';
import { RoleService } from './role.service.js';

@ApiTags('角色')
@Controller('roles')
export class RoleController {
  constructor(private readonly roleService: RoleService) {}

  @Get()
  @RequirePerm('role:read')
  @ApiOperation({ summary: '角色列表' })
  async page(
    @CurrentMember() me: MemberContext,
    @Query() query: QueryRoleDto,
  ): Promise<PageResult<RoleVo>> {
    return this.roleService.page(me, query);
  }

  @Get('options')
  @RequirePerm('role:read')
  @ApiOperation({ summary: '角色下拉选项' })
  async options(
    @CurrentMember() me: MemberContext,
  ): Promise<{ id: string; name: string; code: string }[]> {
    return this.roleService.options(me);
  }

  @Post()
  @RequirePerm('role:create')
  @ApiOperation({ summary: '新增角色' })
  async create(@CurrentMember() me: MemberContext, @Body() dto: CreateRoleDto): Promise<RoleVo> {
    return this.roleService.create(me, dto);
  }

  @Put(':id')
  @RequirePerm('role:update')
  @ApiOperation({ summary: '修改角色' })
  async update(
    @CurrentMember() me: MemberContext,
    @Param('id') id: string,
    @Body() dto: UpdateRoleDto,
  ): Promise<RoleVo> {
    return this.roleService.update(me, parseId(id), dto);
  }

  @Delete(':id')
  @RequirePerm('role:delete')
  @ApiOperation({ summary: '删除角色', description: '内置角色与仍被成员使用的角色不允许删除' })
  async remove(@CurrentMember() me: MemberContext, @Param('id') id: string): Promise<null> {
    await this.roleService.remove(me, parseId(id));
    return null;
  }

  @Get(':id/permissions')
  @RequirePerm('role:read')
  @ApiOperation({ summary: '查看角色已分配的权限码' })
  async permissionCodes(
    @CurrentMember() me: MemberContext,
    @Param('id') id: string,
  ): Promise<string[]> {
    return this.roleService.permissionCodes(me, parseId(id));
  }

  @Put(':id/permissions')
  @RequirePerm('role:update')
  @ApiOperation({ summary: '分配权限', description: '覆盖式：传入的清单即该角色的完整权限' })
  async assignPermissions(
    @CurrentMember() me: MemberContext,
    @Param('id') id: string,
    @Body() dto: AssignPermissionsDto,
  ): Promise<string[]> {
    return this.roleService.assignPermissions(me, parseId(id), dto);
  }
}
