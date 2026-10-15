/**
 * 成员的写操作与档案。
 *
 * user 与 member 是两张表（开发文档与数据库设计的第一条决策）：
 * user 是跨社团的自然人，member 是他在某个社团某个届次里的身份。
 * 新增成员时先按学号找 user，找不到才建——这样同一人换届次/换社团不会重复建档。
 */
import { Injectable } from '@nestjs/common';
import bcrypt from 'bcrypt';
import {
  ErrorCode,
  MemberPosition,
  MEMBER_POSITION_LABEL,
  MemberStatus,
  MEMBER_STATUS_LABEL,
  RegisterSource,
  UserStatus,
  type MemberVo,
  type ProfileVo,
} from '@club/shared';
import { SysConfigService } from '../../common/config/sys-config.service.js';
import { BizException } from '../../common/exceptions/biz.exception.js';
import { buildScopeWhere } from '../../common/prisma/data-scope.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import type { MemberContext } from '../../common/types/member-context.js';
import { parseId } from '../../common/utils/parse-id.js';
import { TermService } from '../term/term.service.js';
import { CreateMemberDto, UpdateMemberDto } from './dto/write-member.dto.js';
import { toMemberVo, type MemberRow } from './member.mapper.js';

const BCRYPT_COST = 10;
const DEFAULT_INIT_PASSWORD = 'Xy@123456';

export interface CreateMemberResult {
  member: MemberVo;
  /** 本次新建账号时使用的初始密码，返回给操作者转告成员；复用已有账号时为 null */
  initialPassword: string | null;
  /** 学号已存在、直接复用了已有账号 */
  reusedUser: boolean;
}

export interface MemberDetailVo extends MemberVo {
  joinDateFull: string | null;
  leaveDate: string | null;
  leaveReason: string | null;
  /** 当前届次内的积分流水条数，档案页展示用 */
  pointRecordCount: number;
  /** 已缴会费笔数 */
  paidFeeCount: number;
  /** 报名过的活动数 */
  registrationCount: number;
}

@Injectable()
export class MemberWriteService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly termService: TermService,
    private readonly sysConfig: SysConfigService,
  ) {}

  // ---------------------------------------------------------------------------
  // 新增
  // ---------------------------------------------------------------------------

  async create(me: MemberContext, dto: CreateMemberDto): Promise<CreateMemberResult> {
    const studentNo = dto.studentNo.trim();

    const existingUser = await this.prisma.client.user.findFirst({
      where: { studentNo },
      select: { id: true, realName: true },
    });

    const termId = await this.termService.currentTermId(me);

    // 同一届次同一人只能有一条成员记录
    if (existingUser !== null) {
      const duplicate = await this.prisma.client.member.findFirst({
        where: { clubId: me.clubId, userId: existingUser.id, termId },
        select: { id: true },
      });
      if (duplicate !== null) {
        throw new BizException(
          ErrorCode.DUPLICATE_RECORD,
          `学号 ${studentNo}（${existingUser.realName}）在当前届次已经是成员了`,
        );
      }
    }

    const deptId = await this.resolveDeptId(me, dto.deptId ?? null);
    const roleIds = await this.resolveRoleIds(me, dto.roleIds ?? []);

    const initPassword = await this.sysConfig.get('member.initPassword');
    const plainPassword = initPassword ?? DEFAULT_INIT_PASSWORD;

    const result = await this.prisma.transaction(async (tx) => {
      let userId: bigint;
      let initialPassword: string | null = null;

      if (existingUser !== null) {
        // 复用已有自然人，顺手补齐资料
        userId = existingUser.id;
        await tx.user.update({
          where: { id: userId },
          data: {
            realName: dto.realName,
            gender: dto.gender ?? 0,
            grade: dto.grade,
            major: dto.major,
            className: dto.className,
            phone: dto.phone,
            email: dto.email,
            updatedBy: me.userId,
          },
        });
      } else {
        const passwordHash = await bcrypt.hash(plainPassword, BCRYPT_COST);
        const created = await tx.user.create({
          data: {
            username: studentNo,
            passwordHash,
            realName: dto.realName,
            studentNo,
            gender: dto.gender ?? 0,
            grade: dto.grade,
            major: dto.major,
            className: dto.className,
            phone: dto.phone,
            email: dto.email,
            registerSource: RegisterSource.ADMIN,
            status: UserStatus.NORMAL,
            createdBy: me.userId,
          },
        });
        userId = created.id;
        initialPassword = plainPassword;
      }

      const member = await tx.member.create({
        data: {
          clubId: me.clubId,
          userId,
          termId,
          deptId,
          memberNo: await this.nextMemberNo(me.clubId),
          position: dto.position ?? MemberPosition.MEMBER,
          isCore: dto.isCore ?? false,
          joinDate: dto.joinDate !== undefined ? new Date(dto.joinDate) : new Date(),
          status: MemberStatus.ACTIVE,
          createdBy: me.userId,
        },
      });

      if (roleIds.length > 0) {
        await tx.memberRole.createMany({
          data: roleIds.map((roleId) => ({ memberId: member.id, roleId })),
        });
      }

      return { memberId: member.id, initialPassword };
    });

    const member = await this.loadMemberVo(me, result.memberId);
    return {
      member,
      initialPassword: result.initialPassword,
      reusedUser: existingUser !== null,
    };
  }

  // ---------------------------------------------------------------------------
  // 修改
  // ---------------------------------------------------------------------------

  async update(me: MemberContext, id: bigint, dto: UpdateMemberDto): Promise<MemberVo> {
    const current = await this.findInScope(me, id);
    const term = await this.prisma.client.term.findFirstOrThrow({
      where: { id: current.termId },
      select: { status: true },
    });
    if (term.status === 2) {
      throw new BizException(ErrorCode.TERM_ARCHIVED);
    }

    const deptId =
      dto.deptId === undefined ? undefined : await this.resolveDeptId(me, dto.deptId);
    const roleIds = dto.roleIds === undefined ? undefined : await this.resolveRoleIds(me, dto.roleIds);

    await this.prisma.transaction(async (tx) => {
      await tx.user.update({
        where: { id: current.userId },
        data: {
          realName: dto.realName,
          gender: dto.gender,
          grade: dto.grade,
          major: dto.major,
          className: dto.className,
          phone: dto.phone,
          email: dto.email,
          updatedBy: me.userId,
        },
      });

      await tx.member.update({
        where: { id },
        data: {
          deptId,
          position: dto.position,
          isCore: dto.isCore,
          status: dto.status,
          leaveDate: dto.leaveDate === undefined ? undefined : new Date(dto.leaveDate),
          leaveReason: dto.leaveReason,
          updatedBy: me.userId,
        },
      });

      if (roleIds !== undefined) {
        // 角色是整体替换语义，先清后建
        await tx.memberRole.deleteMany({ where: { memberId: id } });
        if (roleIds.length > 0) {
          await tx.memberRole.createMany({
            data: roleIds.map((roleId) => ({ memberId: id, roleId })),
          });
        }
      }
    });

    return this.loadMemberVo(me, id);
  }

  // ---------------------------------------------------------------------------
  // 详情与档案
  // ---------------------------------------------------------------------------

  async detail(me: MemberContext, id: bigint): Promise<MemberDetailVo> {
    const base = await this.loadMemberVo(me, id);
    const member = await this.prisma.client.member.findFirstOrThrow({
      where: { id },
      select: { leaveDate: true, leaveReason: true, joinDate: true, userId: true },
    });

    const [pointRecordCount, paidFeeCount, registrationCount] = await Promise.all([
      this.prisma.client.pointRecord.count({ where: { memberId: id } }),
      this.prisma.client.memberFee.count({ where: { memberId: id, status: { gte: 2 } } }),
      this.prisma.client.activityRegistration.count({ where: { memberId: id } }),
    ]);

    return {
      ...base,
      joinDateFull: member.joinDate?.toISOString().slice(0, 10) ?? null,
      leaveDate: member.leaveDate?.toISOString().slice(0, 10) ?? null,
      leaveReason: member.leaveReason,
      pointRecordCount,
      paidFeeCount,
      registrationCount,
    };
  }

  /** 成员档案页：看自己的资料与积分、缴费、活动记录 */
  async profile(me: MemberContext): Promise<MemberDetailVo & { account: ProfileVo }> {
    const detail = await this.detail(me, me.memberId);
    const user = await this.prisma.client.user.findFirstOrThrow({
      where: { id: me.userId },
      select: { username: true, avatarUrl: true },
    });
    const club = await this.prisma.client.club.findFirstOrThrow({
      where: { id: me.clubId },
      select: { name: true, shortName: true },
    });
    const term = await this.prisma.client.term.findFirstOrThrow({
      where: { id: me.termId },
      select: { name: true },
    });

    const account: ProfileVo = {
      userId: me.userId.toString(),
      username: user.username,
      realName: me.realName,
      avatarUrl: user.avatarUrl,
      memberId: me.memberId.toString(),
      memberNo: me.memberNo,
      position: me.position,
      positionLabel: MEMBER_POSITION_LABEL[me.position as MemberPosition] ?? String(me.position),
      deptId: me.deptId?.toString() ?? null,
      deptName: me.deptName,
      clubId: me.clubId.toString(),
      clubName: club.name,
      clubShortName: club.shortName,
      termId: me.termId.toString(),
      termName: term.name,
      roles: me.roles.map((role) => ({
        id: role.id.toString(),
        code: role.code,
        name: role.name,
      })),
      permissions: [...me.permissions],
      maxDataScope: me.maxDataScope,
    };

    return { ...detail, account };
  }

  // ---------------------------------------------------------------------------
  // 内部
  // ---------------------------------------------------------------------------

  private async loadMemberVo(me: MemberContext, id: bigint): Promise<MemberVo> {
    // 必须先过数据范围，防止越权查看他人档案
    const record = await this.findInScope(me, id);
    const row = await this.prisma.client.member.findFirstOrThrow({
      where: { id: record.id },
      include: {
        user: true,
        dept: { select: { id: true, name: true } },
        roles: { include: { role: { select: { id: true, code: true, name: true } } } },
      },
    });
    return toMemberVo(row as unknown as MemberRow);
  }

  /** 详情/修改都要求目标在当前用户的数据范围内 */
  private async findInScope(
    me: MemberContext,
    id: bigint,
  ): Promise<{ id: bigint; userId: bigint; termId: bigint }> {
    const scopeWhere = await buildScopeWhere(this.prisma, me, 'member');
    const row = await this.prisma.client.member.findFirst({
      where: { ...scopeWhere, id },
      select: { id: true, userId: true, termId: true },
    });
    if (row === null) {
      const exists = await this.prisma.client.member.findFirst({
        where: { id },
        select: { id: true },
      });
      if (exists === null) throw new BizException(ErrorCode.MEMBER_NOT_FOUND);
      throw new BizException(ErrorCode.OUT_OF_DATA_SCOPE);
    }
    return row;
  }

  private async resolveDeptId(me: MemberContext, raw: string | null): Promise<bigint | null> {
    if (raw === null || raw === undefined || raw === '') return null;
    const deptId = parseId(raw);
    const dept = await this.prisma.client.department.findFirst({
      where: { id: deptId, clubId: me.clubId },
      select: { id: true },
    });
    if (dept === null) throw new BizException(ErrorCode.NOT_FOUND, '指定的部门不存在');
    return deptId;
  }

  private async resolveRoleIds(me: MemberContext, raws: string[]): Promise<bigint[]> {
    if (raws.length === 0) return [];
    const ids = raws.map((raw) => parseId(raw));
    const roles = await this.prisma.client.role.findMany({
      where: { id: { in: ids }, clubId: me.clubId },
      select: { id: true },
    });
    if (roles.length !== ids.length) {
      throw new BizException(ErrorCode.PARAM_INVALID, '存在不属于本社团的角色');
    }
    return ids;
  }

  /**
   * 成员编号：XYAS-2026-011。
   *
   * 取当前最大序号 +1 而不是用总数：软删除后总数会变小，用总数会撞号。
   * memberNo 上没有唯一索引，并发导入理论上仍可能重号；这是有意取舍——
   * 编号只是给人看的，真正的身份是 id，不值得为它加唯一约束与重试逻辑。
   */
  private async nextMemberNo(clubId: bigint): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `XYAS-${year}-`;
    const latest = await this.prisma.client.member.findFirst({
      where: { clubId, memberNo: { startsWith: prefix } },
      orderBy: { memberNo: 'desc' },
      select: { memberNo: true },
    });
    const lastSeq = latest?.memberNo?.split('-').at(-1);
    const next = lastSeq === undefined ? 1 : Number.parseInt(lastSeq, 10) + 1;
    return `${prefix}${String(Number.isNaN(next) ? 1 : next).padStart(3, '0')}`;
  }
}
