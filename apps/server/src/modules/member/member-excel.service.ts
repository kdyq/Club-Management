/**
 * 成员 Excel 导入导出。
 *
 * 两条硬要求：
 * 1. **导出必须过数据范围**——Excel 导出是最容易被忽略的越权入口，
 *    所以这里复用 MemberService 的 where 构造，与列表页口径完全一致。
 * 2. 导入要逐行报错，不能一行不合格就整批失败；同时每一行都要给出可读的中文原因。
 */
import { Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import {
  ErrorCode,
  MemberPosition,
  MEMBER_POSITION_LABEL,
  type MemberVo,
} from '@club/shared';
import { BizException } from '../../common/exceptions/biz.exception.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import type { MemberContext } from '../../common/types/member-context.js';
import type { QueryMemberDto } from './dto/query-member.dto.js';
import type { CreateMemberDto } from './dto/write-member.dto.js';
import { MemberService } from './member.service.js';
import { MemberWriteService } from './member-write.service.js';

const SHEET_NAME = '成员名单';
const MAX_IMPORT_ROWS = 1000;

interface ImportColumn {
  header: string;
  key: string;
  required: boolean;
  width: number;
  note?: string;
}

/** 导入模板的列定义。改这里，模板、导入解析、导出表头会一起变。 */
const COLUMNS: readonly ImportColumn[] = [
  { header: '姓名', key: 'realName', required: true, width: 12 },
  { header: '学号', key: 'studentNo', required: true, width: 16 },
  { header: '性别', key: 'gender', required: false, width: 8, note: '男 / 女，留空为未填' },
  { header: '年级', key: 'grade', required: false, width: 8, note: '如 2026' },
  { header: '专业', key: 'major', required: false, width: 22 },
  { header: '班级', key: 'className', required: false, width: 14 },
  { header: '手机号', key: 'phone', required: false, width: 16 },
  { header: '邮箱', key: 'email', required: false, width: 26 },
  { header: '部门', key: 'deptName', required: false, width: 14, note: '需与系统中部门名一致' },
  {
    header: '职务',
    key: 'positionLabel',
    required: false,
    width: 12,
    note: `社长/副社长/部长/副部长/干事/普通成员，留空为普通成员`,
  },
  { header: '角色', key: 'roleCode', required: false, width: 18, note: '角色编码，多个用逗号分隔' },
  { header: '核心成员', key: 'isCore', required: false, width: 10, note: '是 / 否，留空为否' },
];

export interface ImportRowError {
  row: number;
  realName: string;
  reason: string;
}

export interface ImportResult {
  total: number;
  success: number;
  failed: number;
  errors: ImportRowError[];
  /** 新建账号时的初始密码（复用已有账号的不在其中） */
  initialPassword: string | null;
}

@Injectable()
export class MemberExcelService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly memberService: MemberService,
    private readonly memberWriteService: MemberWriteService,
  ) {}

  // ---------------------------------------------------------------------------
  // 导出
  // ---------------------------------------------------------------------------

  async export(me: MemberContext, query: QueryMemberDto): Promise<Buffer> {
    const list = await this.memberService.listForExport(me, query);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = '社团管理系统';
    workbook.created = new Date();
    const sheet = workbook.addWorksheet(SHEET_NAME);

    sheet.columns = [
      { header: '成员编号', key: 'memberNo', width: 16 },
      { header: '姓名', key: 'realName', width: 12 },
      { header: '学号', key: 'studentNo', width: 16 },
      { header: '性别', key: 'gender', width: 8 },
      { header: '年级', key: 'grade', width: 8 },
      { header: '专业', key: 'major', width: 22 },
      { header: '班级', key: 'className', width: 14 },
      { header: '部门', key: 'deptName', width: 14 },
      { header: '职务', key: 'positionLabel', width: 12 },
      { header: '角色', key: 'roles', width: 20 },
      { header: '状态', key: 'statusLabel', width: 10 },
      { header: '核心成员', key: 'isCore', width: 10 },
      { header: '积分', key: 'totalPoints', width: 8 },
      { header: '手机号', key: 'phone', width: 16 },
      { header: '邮箱', key: 'email', width: 26 },
      { header: '加入日期', key: 'joinDate', width: 14 },
    ];

    for (const member of list) {
      sheet.addRow({
        memberNo: member.memberNo ?? '',
        realName: member.realName,
        studentNo: member.studentNo ?? '',
        gender: member.gender === 1 ? '男' : member.gender === 2 ? '女' : '',
        grade: member.grade ?? '',
        major: member.major ?? '',
        className: member.className ?? '',
        deptName: member.deptName ?? '',
        positionLabel: member.positionLabel,
        roles: member.roles.map((role) => role.name).join('、'),
        statusLabel: member.statusLabel,
        isCore: member.isCore ? '是' : '否',
        totalPoints: member.totalPoints,
        phone: member.phone ?? '',
        email: member.email ?? '',
        joinDate: member.joinDate ?? '',
      });
    }

    styleHeaderRow(sheet.getRow(1), COLUMNS.length + 4);
    sheet.views = [{ state: 'frozen', ySplit: 1 }];

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  // ---------------------------------------------------------------------------
  // 模板
  // ---------------------------------------------------------------------------

  async template(): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = '社团管理系统';

    const sheet = workbook.addWorksheet(SHEET_NAME);
    sheet.columns = COLUMNS.map((col) => ({ header: col.header, key: col.key, width: col.width }));
    sheet.addRow({
      realName: '示例·张三',
      studentNo: '2026100199',
      gender: '男',
      grade: '2026',
      major: '天文学',
      className: '天文2601',
      phone: '13800000000',
      email: 'zhangsan@example.edu.cn',
      deptName: '观测部',
      positionLabel: '干事',
      roleCode: 'officer',
      isCore: '否',
    });
    styleHeaderRow(sheet.getRow(1), COLUMNS.length);

    const noteSheet = workbook.addWorksheet('填写说明');
    noteSheet.columns = [
      { header: '列名', key: 'header', width: 14 },
      { header: '是否必填', key: 'required', width: 10 },
      { header: '说明', key: 'note', width: 60 },
    ];
    for (const col of COLUMNS) {
      noteSheet.addRow({
        header: col.header,
        required: col.required ? '必填' : '选填',
        note: col.note ?? '',
      });
    }
    styleHeaderRow(noteSheet.getRow(1), 3);

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  // ---------------------------------------------------------------------------
  // 导入
  // ---------------------------------------------------------------------------

  async import(me: MemberContext, fileBuffer: Buffer, originalName: string): Promise<ImportResult> {
    if (!/\.(xlsx|xlsm)$/i.test(originalName)) {
      throw new BizException(ErrorCode.FILE_TYPE_NOT_ALLOWED, '只支持 .xlsx 格式的 Excel 文件');
    }

    const workbook = new ExcelJS.Workbook();
    try {
      // exceljs 自带的 Buffer 类型与 @types/node 的 Buffer 泛型对不上，这里按其入参类型转一次
      await workbook.xlsx.load(fileBuffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);
    } catch {
      throw new BizException(ErrorCode.EXCEL_CONTENT_INVALID, '文件无法解析，请确认是有效的 Excel');
    }

    const sheet = workbook.getWorksheet(SHEET_NAME) ?? workbook.worksheets[0];
    if (sheet === undefined) {
      throw new BizException(ErrorCode.EXCEL_CONTENT_INVALID, '文件里没有工作表');
    }

    const headerRow = sheet.getRow(1);
    const columnIndex = new Map<string, number>();
    headerRow.eachCell((cell, colNumber) => {
      const text = cellText(cell.value);
      if (text !== '') columnIndex.set(text, colNumber);
    });

    const missing = COLUMNS.filter((col) => col.required && !columnIndex.has(col.header));
    if (missing.length > 0) {
      throw new BizException(
        ErrorCode.EXCEL_CONTENT_INVALID,
        `表头缺少必填列：${missing.map((col) => col.header).join('、')}。请先下载导入模板。`,
      );
    }

    const dataRows: { rowNumber: number; values: Record<string, string> }[] = [];
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const values: Record<string, string> = {};
      let hasAny = false;
      for (const col of COLUMNS) {
        const index = columnIndex.get(col.header);
        const raw = index === undefined ? '' : cellText(row.getCell(index).value);
        values[col.key] = raw;
        if (raw !== '') hasAny = true;
      }
      // 整行空白直接跳过，不算错误
      if (hasAny) dataRows.push({ rowNumber, values });
    });

    if (dataRows.length === 0) {
      throw new BizException(ErrorCode.EXCEL_CONTENT_INVALID, '没有读到任何数据行');
    }
    if (dataRows.length > MAX_IMPORT_ROWS) {
      throw new BizException(
        ErrorCode.EXCEL_CONTENT_INVALID,
        `单次最多导入 ${MAX_IMPORT_ROWS} 行，当前 ${dataRows.length} 行，请分批导入`,
      );
    }

    const deptIdByName = await this.deptMap(me);
    const roleIdByCode = await this.roleMap(me);

    const errors: ImportRowError[] = [];
    let success = 0;
    let initialPassword: string | null = null;

    for (const { rowNumber, values } of dataRows) {
      const realName = values.realName?.trim() ?? '';
      try {
        if (realName === '') throw new BizException(ErrorCode.PARAM_INVALID, '姓名不能为空');
        const studentNo = values.studentNo?.trim() ?? '';
        if (studentNo === '') throw new BizException(ErrorCode.PARAM_INVALID, '学号不能为空');

        const dto: CreateMemberDto = {
          realName,
          studentNo,
          gender: parseGender(values.gender ?? ''),
          grade: emptyToUndefined(values.grade),
          major: emptyToUndefined(values.major),
          className: emptyToUndefined(values.className),
          phone: emptyToUndefined(values.phone),
          email: emptyToUndefined(values.email),
          position: parsePosition(values.positionLabel ?? ''),
          isCore: parseBoolean(values.isCore ?? ''),
        };

        const deptName = values.deptName?.trim() ?? '';
        if (deptName !== '') {
          const deptId = deptIdByName.get(deptName);
          if (deptId === undefined) {
            throw new BizException(ErrorCode.PARAM_INVALID, `部门「${deptName}」不存在`);
          }
          dto.deptId = deptId;
        }

        const roleCode = values.roleCode?.trim() ?? '';
        if (roleCode !== '') {
          const codes = roleCode.split(/[,，、]/).map((item) => item.trim()).filter((item) => item !== '');
          const roleIds: string[] = [];
          for (const code of codes) {
            const id = roleIdByCode.get(code);
            if (id === undefined) throw new BizException(ErrorCode.PARAM_INVALID, `角色「${code}」不存在`);
            roleIds.push(id);
          }
          dto.roleIds = roleIds;
        }

        const result = await this.memberWriteService.create(me, dto);
        if (result.initialPassword !== null) initialPassword = result.initialPassword;
        success += 1;
      } catch (error) {
        errors.push({
          row: rowNumber,
          realName: realName === '' ? '（空）' : realName,
          reason: error instanceof BizException ? error.message : '未知错误',
        });
      }
    }

    return {
      total: dataRows.length,
      success,
      failed: errors.length,
      errors,
      initialPassword,
    };
  }

  // ---------------------------------------------------------------------------
  // 内部
  // ---------------------------------------------------------------------------

  private async deptMap(me: MemberContext): Promise<Map<string, string>> {
    const rows = await this.prisma.client.department.findMany({
      where: { clubId: me.clubId },
      select: { id: true, name: true },
    });
    return new Map(rows.map((row) => [row.name, row.id.toString()]));
  }

  private async roleMap(me: MemberContext): Promise<Map<string, string>> {
    const rows = await this.prisma.client.role.findMany({
      where: { clubId: me.clubId },
      select: { id: true, code: true, name: true },
    });
    const map = new Map<string, string>();
    for (const row of rows) {
      map.set(row.code, row.id.toString());
      // 也接受角色名，导入时写中文更自然
      map.set(row.name, row.id.toString());
    }
    return map;
  }
}

// -----------------------------------------------------------------------------
// 单元格与文本解析
// -----------------------------------------------------------------------------

/** Excel 单元格可能是富文本、公式、数字，统一取成纯文本 */
function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'object') {
    const rich = value as { richText?: { text: string }[]; text?: string; result?: unknown };
    if (Array.isArray(rich.richText)) return rich.richText.map((part) => part.text).join('').trim();
    if (typeof rich.text === 'string') return rich.text.trim();
    if (rich.result !== undefined) return String(rich.result);
  }
  return '';
}

function emptyToUndefined(value: string | undefined): string | undefined {
  const trimmed = value?.trim() ?? '';
  return trimmed === '' ? undefined : trimmed;
}

function parseGender(value: string): number {
  const text = value.trim();
  if (text === '男' || text === '1') return 1;
  if (text === '女' || text === '2') return 2;
  return 0;
}

function parseBoolean(value: string): boolean {
  const text = value.trim().toLowerCase();
  return text === '是' || text === 'true' || text === '1' || text === 'y';
}

function parsePosition(value: string): number {
  const text = value.trim();
  if (text === '') return MemberPosition.MEMBER;

  for (const [key, label] of Object.entries(MEMBER_POSITION_LABEL)) {
    if (label === text) return Number(key);
  }
  const asNumber = Number.parseInt(text, 10);
  if (!Number.isNaN(asNumber) && asNumber >= 1 && asNumber <= 6) return asNumber;
  throw new BizException(ErrorCode.PARAM_INVALID, `职务「${text}」无法识别`);
}

function styleHeaderRow(row: ExcelJS.Row, columnCount: number): void {
  row.font = { bold: true };
  row.height = 22;
  for (let index = 1; index <= columnCount; index += 1) {
    const cell = row.getCell(index);
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEDF0FB' } };
    cell.alignment = { vertical: 'middle', horizontal: 'left' };
  }
}

export type { MemberVo };
