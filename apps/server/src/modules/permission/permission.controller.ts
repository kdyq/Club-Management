import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { PermissionNodeVo } from '@club/shared';
import { RequirePerm } from '../../common/decorators/require-perm.decorator.js';
import { PermissionService } from './permission.service.js';

@ApiTags('权限')
@Controller('permissions')
export class PermissionController {
  constructor(private readonly permissionService: PermissionService) {}

  @Get('tree')
  @RequirePerm('permission:read')
  @ApiOperation({ summary: '权限树', description: '目录 / 菜单 / 按钮三层，用于角色授权界面' })
  async tree(): Promise<PermissionNodeVo[]> {
    return this.permissionService.tree();
  }

  @Get('flat')
  @RequirePerm('permission:read')
  @ApiOperation({ summary: '权限扁平清单' })
  async flat(): Promise<{ code: string; name: string; type: number }[]> {
    return this.permissionService.flat();
  }
}
