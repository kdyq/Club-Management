import { createReadStream } from 'node:fs';
import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { ErrorCode, FileScope } from '@club/shared';
import { CurrentMember } from '../../common/decorators/current-member.decorator.js';
import { RequirePerm } from '../../common/decorators/require-perm.decorator.js';
import { BizException } from '../../common/exceptions/biz.exception.js';
import type { MemberContext } from '../../common/types/member-context.js';
import { parseId } from '../../common/utils/parse-id.js';
import { FileService, type FileVo, type UploadedFileLike } from './file.service.js';

@ApiTags('文件')
@Controller('files')
export class FileController {
  constructor(private readonly fileService: FileService) {}

  @Post('upload')
  @RequirePerm('file:create')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 50 * 1024 * 1024 } }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @ApiQuery({ name: 'scope', required: false, description: '可见范围 1 公开 / 2 成员 / 3 部门 / 4 角色 / 5 私有' })
  @ApiQuery({ name: 'bizType', required: false })
  @ApiQuery({ name: 'bizId', required: false })
  @ApiOperation({
    summary: '上传文件',
    description: '扩展名与 MIME 双重白名单；UUID 重命名；带 MD5 秒传；大小上限取自 sys_config。',
  })
  async upload(
    @CurrentMember() me: MemberContext,
    @UploadedFile() file: UploadedFileLike | undefined,
    @Query('scope') scope?: string,
    @Query('bizType') bizType?: string,
    @Query('bizId') bizId?: string,
  ): Promise<FileVo> {
    if (file === undefined) throw new BizException(ErrorCode.PARAM_INVALID, '请选择要上传的文件');
    const parsedScope = scope === undefined ? FileScope.MEMBER : Number.parseInt(scope, 10);
    return this.fileService.upload(me, file, { scope: parsedScope, bizType, bizId });
  }

  @Get()
  @RequirePerm('file:read')
  @ApiOperation({ summary: '文件列表' })
  async list(
    @CurrentMember() me: MemberContext,
    @Query('bizType') bizType?: string,
    @Query('bizId') bizId?: string,
  ): Promise<{ list: FileVo[]; total: number }> {
    return this.fileService.list(me, { bizType, bizId });
  }

  @Get(':id/download')
  @ApiOperation({
    summary: '下载文件',
    description: '走鉴权接口，不暴露磁盘路径；私有文件只有上传者能下。',
  })
  async download(
    @CurrentMember() me: MemberContext,
    @Param('id') id: string,
    @Res() response: Response,
  ): Promise<void> {
    const file = await this.fileService.getForDownload(me, parseId(id));

    response.setHeader('Content-Type', file.mime ?? 'application/octet-stream');
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="download"; filename*=UTF-8''${encodeURIComponent(file.name)}`,
    );
    createReadStream(file.absolutePath).pipe(response);
  }

  @Delete(':id')
  @RequirePerm('file:delete')
  @ApiOperation({ summary: '删除文件', description: '只能删自己上传的；共享同一物理文件时不会误删磁盘文件' })
  async remove(@CurrentMember() me: MemberContext, @Param('id') id: string): Promise<null> {
    await this.fileService.remove(me, parseId(id));
    return null;
  }
}
