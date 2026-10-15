/**
 * 文件存储（开发文档 7.8 节）。
 *
 * 几条安全约定，逐条都有理由：
 * - 按扩展名与 MIME **双重**白名单校验，不信任客户端传来的 Content-Type
 * - 文件名用 UUID 重命名，**绝不使用用户上传的原始文件名做路径**（防路径穿越）
 * - 大小上限从 sys_config 读，默认 20MB
 * - 上传时算 MD5，命中已有记录则复用磁盘文件（秒传），MD5 上有索引
 * - 下载走鉴权接口，不直接暴露磁盘路径
 * - storageType 字段预留，将来切对象存储只改这里
 */
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync } from 'node:fs';
import { unlink, writeFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { Injectable, Logger } from '@nestjs/common';
import { ErrorCode, FileScope, StorageType } from '@club/shared';
import { SysConfigService } from '../../common/config/sys-config.service.js';
import { BizException } from '../../common/exceptions/biz.exception.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import type { MemberContext } from '../../common/types/member-context.js';

/** 允许的扩展名 → 允许的 MIME。两个都要对得上才收。 */
const ALLOWED: Record<string, readonly string[]> = {
  '.jpg': ['image/jpeg'],
  '.jpeg': ['image/jpeg'],
  '.png': ['image/png'],
  '.gif': ['image/gif'],
  '.webp': ['image/webp'],
  '.pdf': ['application/pdf'],
  '.doc': ['application/msword'],
  '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  '.xls': ['application/vnd.ms-excel'],
  '.xlsx': ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  '.ppt': ['application/vnd.ms-powerpoint'],
  '.pptx': ['application/vnd.openxmlformats-officedocument.presentationml.presentation'],
  '.zip': ['application/zip', 'application/x-zip-compressed'],
  '.rar': ['application/vnd.rar', 'application/x-rar-compressed'],
  '.txt': ['text/plain'],
  '.csv': ['text/csv', 'application/vnd.ms-excel'],
  '.md': ['text/markdown', 'text/plain'],
};

const DEFAULT_MAX_BYTES = 20 * 1024 * 1024;

export interface UploadedFileLike {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

export interface FileVo {
  id: string;
  name: string;
  originalName: string;
  ext: string | null;
  mimeType: string | null;
  size: string;
  scope: number;
  folderId: string | null;
  uploaderName: string | null;
  downloadCount: number;
  createdAt: string;
}

@Injectable()
export class FileService {
  private readonly logger = new Logger(FileService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sysConfig: SysConfigService,
  ) {}

  private rootDir(): string {
    return resolve(process.env.UPLOAD_DIR ?? 'storage/uploads');
  }

  private async maxBytes(): Promise<number> {
    return this.sysConfig.getInt('upload.maxSize', DEFAULT_MAX_BYTES);
  }

  // ---------------------------------------------------------------------------
  // 上传
  // ---------------------------------------------------------------------------

  async upload(
    me: MemberContext,
    file: UploadedFileLike,
    options: { folderId?: string | null; scope?: number; bizType?: string; bizId?: string } = {},
  ): Promise<FileVo> {
    const originalName = file.originalname;
    const ext = extname(originalName).toLowerCase();

    const allowedMimes = ALLOWED[ext];
    if (allowedMimes === undefined) {
      throw new BizException(
        ErrorCode.FILE_TYPE_NOT_ALLOWED,
        `不支持的文件类型 ${ext || '（无扩展名）'}`,
      );
    }
    if (!allowedMimes.includes(file.mimetype)) {
      throw new BizException(
        ErrorCode.FILE_TYPE_NOT_ALLOWED,
        `文件类型与扩展名不匹配（声明为 ${file.mimetype}）`,
      );
    }

    const max = await this.maxBytes();
    if (file.size > max) {
      throw new BizException(
        ErrorCode.FILE_TOO_LARGE,
        `文件超过大小上限 ${(max / 1024 / 1024).toFixed(1)}MB`,
      );
    }

    const md5 = createHash('md5').update(file.buffer).digest('hex');

    // 秒传：磁盘上已有同样内容就直接复用，不再写一遍
    const existing = await this.prisma.client.fileItem.findFirst({
      where: { clubId: me.clubId, md5, storageType: StorageType.LOCAL },
      select: { storagePath: true },
    });

    let storagePath: string;
    if (existing !== null && existsSync(join(this.rootDir(), existing.storagePath))) {
      storagePath = existing.storagePath;
      this.logger.log(`命中 MD5 ${md5.slice(0, 8)}…，复用已有存储文件`);
    } else {
      const now = new Date();
      const year = String(now.getFullYear());
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const relativeDir = join(year, month);
      const absoluteDir = join(this.rootDir(), relativeDir);
      mkdirSync(absoluteDir, { recursive: true });

      // UUID 重命名：即使用户把文件名写成 ../../etc/passwd 也无从下手
      const storedName = `${randomUUID()}${ext}`;
      storagePath = join(relativeDir, storedName);
      await writeFile(join(this.rootDir(), storagePath), file.buffer);
    }

    const row = await this.prisma.client.fileItem.create({
      data: {
        clubId: me.clubId,
        folderId: options.folderId === undefined || options.folderId === null ? null : BigInt(options.folderId),
        name: originalName.slice(0, 255),
        originalName: originalName.slice(0, 255),
        ext: ext.replace('.', ''),
        mimeType: file.mimetype,
        size: BigInt(file.size),
        storageType: StorageType.LOCAL,
        storagePath,
        md5,
        scope: options.scope ?? FileScope.MEMBER,
        uploaderId: me.userId,
        bizType: options.bizType ?? null,
        bizId: options.bizId === undefined ? null : BigInt(options.bizId),
        status: 1,
      },
      include: { uploader: { select: { realName: true } } },
    });

    return toFileVo(row as never);
  }

  // ---------------------------------------------------------------------------
  // 读取与下载
  // ---------------------------------------------------------------------------

  async getForDownload(
    me: MemberContext,
    id: bigint,
  ): Promise<{ absolutePath: string; name: string; mime: string | null }> {
    const row = await this.prisma.client.fileItem.findFirst({
      where: { id, clubId: me.clubId },
      select: {
        id: true,
        originalName: true,
        mimeType: true,
        storagePath: true,
        scope: true,
        uploaderId: true,
        downloadCount: true,
      },
    });
    if (row === null) throw new BizException(ErrorCode.NOT_FOUND, '文件不存在');

    // 权限：公开与成员可见的文件，本社团登录用户都能下；
    // 私有文件只有上传者本人能下。部门/角色可见的精细授权放在阶段 5 的 FileGrant。
    if (row.scope === FileScope.PRIVATE && row.uploaderId !== me.userId) {
      throw new BizException(ErrorCode.FORBIDDEN, '该文件是私有的，只有上传者可以下载');
    }

    const absolutePath = join(this.rootDir(), row.storagePath);
    if (!existsSync(absolutePath)) {
      throw new BizException(ErrorCode.NOT_FOUND, '文件记录存在但磁盘上已经找不到了');
    }

    await this.prisma.client.fileItem.update({
      where: { id },
      data: { downloadCount: { increment: 1 } },
    });

    return { absolutePath, name: row.originalName, mime: row.mimeType };
  }

  async list(
    me: MemberContext,
    options: { bizType?: string; bizId?: string; page?: number; pageSize?: number } = {},
  ): Promise<{ list: FileVo[]; total: number }> {
    const where: Record<string, unknown> = { clubId: me.clubId };
    if (options.bizType !== undefined) where.bizType = options.bizType;
    if (options.bizId !== undefined && options.bizId !== '') where.bizId = BigInt(options.bizId);

    const rows = await this.prisma.client.fileItem.findMany({
      where,
      orderBy: { id: 'desc' },
      take: options.pageSize ?? 50,
      include: { uploader: { select: { realName: true } } },
    });
    return { list: rows.map((row) => toFileVo(row as never)), total: rows.length };
  }

  async remove(me: MemberContext, id: bigint): Promise<void> {
    const row = await this.prisma.client.fileItem.findFirst({
      where: { id, clubId: me.clubId },
      select: { id: true, uploaderId: true, storagePath: true, md5: true },
    });
    if (row === null) throw new BizException(ErrorCode.NOT_FOUND, '文件不存在');
    if (row.uploaderId !== me.userId && !me.permissions.has('file:delete')) {
      throw new BizException(ErrorCode.FORBIDDEN, '只能删除自己上传的文件');
    }

    await this.prisma.client.fileItem.delete({ where: { id } });

    // 还有别的记录引用同一个物理文件时不要删磁盘文件（MD5 秒传会让多个记录共享一个文件）
    if (row.md5 !== null) {
      const stillReferenced = await this.prisma.client.fileItem.count({
        where: { clubId: me.clubId, md5: row.md5 },
      });
      if (stillReferenced > 0) return;
    }
    try {
      await unlink(join(this.rootDir(), row.storagePath));
    } catch {
      // 磁盘文件可能已经被清理，删不掉不影响业务
    }
  }
}

function toFileVo(row: {
  id: bigint;
  name: string;
  originalName: string;
  ext: string | null;
  mimeType: string | null;
  size: bigint;
  scope: number;
  folderId: bigint | null;
  downloadCount: number;
  createdAt: Date;
  uploader: { realName: string } | null;
}): FileVo {
  return {
    id: row.id.toString(),
    name: row.name,
    originalName: row.originalName,
    ext: row.ext,
    mimeType: row.mimeType,
    size: row.size.toString(),
    scope: row.scope,
    folderId: row.folderId?.toString() ?? null,
    uploaderName: row.uploader?.realName ?? null,
    downloadCount: row.downloadCount,
    createdAt: row.createdAt.toISOString(),
  };
}
