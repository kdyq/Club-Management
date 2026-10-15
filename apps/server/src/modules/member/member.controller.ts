import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import type { MemberVo, PageResult } from '@club/shared';
import { CurrentMember } from '../../common/decorators/current-member.decorator.js';
import { RequirePerm } from '../../common/decorators/require-perm.decorator.js';
import { BizException } from '../../common/exceptions/biz.exception.js';
import { ErrorCode } from '@club/shared';
import type { MemberContext } from '../../common/types/member-context.js';
import { parseId } from '../../common/utils/parse-id.js';
import { QueryMemberDto } from './dto/query-member.dto.js';
import { CreateMemberDto, UpdateMemberDto } from './dto/write-member.dto.js';
import {
  MemberExcelService,
  type ImportResult,
} from './member-excel.service.js';
import { MemberService } from './member.service.js';
import {
  MemberWriteService,
  type CreateMemberResult,
  type MemberDetailVo,
} from './member-write.service.js';

const XLSX_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/**
 * Multer 上传的内存文件。这里自己声明结构而不用 Express.Multer.File：
 * 那个全局类型来自 @types/multer 的全局声明合并，在 nodenext 解析下不稳定，
 * 而我们只需要这几个字段。
 */
interface UploadedFileLike {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

@ApiTags('成员')
@Controller('members')
export class MemberController {
  constructor(
    private readonly memberService: MemberService,
    private readonly memberWriteService: MemberWriteService,
    private readonly memberExcelService: MemberExcelService,
  ) {}

  @Get()
  @RequirePerm('member:read')
  @ApiOperation({
    summary: '成员列表',
    description: '结果受当前登录者的数据范围限制：仅本人 / 本部门 / 本部门及以下 / 本社团。',
  })
  async page(
    @CurrentMember() me: MemberContext,
    @Query() query: QueryMemberDto,
  ): Promise<PageResult<MemberVo>> {
    return this.memberService.page(me, query);
  }

  /** 放在 :id 之前，否则会被当成 id */
  @Get('me')
  @ApiOperation({ summary: '我的档案', description: '当前登录者自己的资料、积分与缴费记录' })
  async profile(@CurrentMember() me: MemberContext): Promise<MemberDetailVo & { account: unknown }> {
    return this.memberWriteService.profile(me);
  }

  @Get('import-template')
  @RequirePerm('member:create')
  @ApiOperation({ summary: '下载导入模板' })
  async template(@Res() response: Response): Promise<void> {
    const buffer = await this.memberExcelService.template();
    sendXlsx(response, buffer, '成员导入模板.xlsx');
  }

  @Get('export')
  @RequirePerm('member:export')
  @ApiOperation({
    summary: '导出成员',
    description: '导出结果与列表页口径一致，**同样受数据范围限制**，不是全量导出。',
  })
  async export(
    @CurrentMember() me: MemberContext,
    @Query() query: QueryMemberDto,
    @Res() response: Response,
  ): Promise<void> {
    const buffer = await this.memberExcelService.export(me, query);
    const stamp = new Date().toISOString().slice(0, 10);
    sendXlsx(response, buffer, `成员名单-${stamp}.xlsx`);
  }

  @Post('import')
  @RequirePerm('member:create')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 20 * 1024 * 1024 } }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @ApiOperation({
    summary: '导入成员',
    description: '逐行处理，单行出错不影响其它行；返回每行的失败原因。',
  })
  async import(
    @CurrentMember() me: MemberContext,
    @UploadedFile() file: UploadedFileLike | undefined,
  ): Promise<ImportResult> {
    if (file === undefined) {
      throw new BizException(ErrorCode.PARAM_INVALID, '请选择要导入的文件');
    }
    return this.memberExcelService.import(me, file.buffer, file.originalname);
  }

  @Get(':id')
  @RequirePerm('member:read')
  @ApiOperation({ summary: '成员详情' })
  async detail(
    @CurrentMember() me: MemberContext,
    @Param('id') id: string,
  ): Promise<MemberDetailVo> {
    return this.memberWriteService.detail(me, parseId(id));
  }

  @Post()
  @RequirePerm('member:create')
  @ApiOperation({
    summary: '新增成员',
    description: '按学号复用已有的自然人账号；新建账号时会返回初始密码。',
  })
  async create(
    @CurrentMember() me: MemberContext,
    @Body() dto: CreateMemberDto,
  ): Promise<CreateMemberResult> {
    return this.memberWriteService.create(me, dto);
  }

  @Put(':id')
  @RequirePerm('member:update')
  @ApiOperation({ summary: '修改成员' })
  async update(
    @CurrentMember() me: MemberContext,
    @Param('id') id: string,
    @Body() dto: UpdateMemberDto,
  ): Promise<MemberVo> {
    return this.memberWriteService.update(me, parseId(id), dto);
  }
}

function sendXlsx(response: Response, buffer: Buffer, filename: string): void {
  response.setHeader('Content-Type', XLSX_MIME);
  // 文件名可能含中文，两种写法都给，兼容各浏览器
  response.setHeader(
    'Content-Disposition',
    `attachment; filename="export.xlsx"; filename*=UTF-8''${encodeURIComponent(filename)}`,
  );
  response.setHeader('Content-Length', String(buffer.length));
  response.end(buffer);
}

/** 占位导出，避免未使用告警 */
export type { Request };
