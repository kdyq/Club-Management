/**
 * 认证服务：登录、刷新、登出、组装登录者上下文。
 *
 * 双 token 策略（开发文档 7.4 节）：
 * - access token 2 小时，放在响应体里，前端存内存（Pinia），不进 localStorage
 * - refresh token 14 天，放在 httpOnly Cookie 里，JS 读不到
 *
 * 登录限流：按 IP 与用户名双维度计数，5 次失败锁 10 分钟。
 * 计数键的 TTL 就是锁定时长，计数器本身即锁，不需要额外的锁键。
 */
import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcrypt';
import {
  DataScope,
  ErrorCode,
  MemberPosition,
  MemberStatus,
  MEMBER_POSITION_LABEL,
  UserStatus,
  type LoginVo,
  type ProfileVo,
} from '@club/shared';
import { SysConfigService } from '../../common/config/sys-config.service.js';
import { BizException } from '../../common/exceptions/biz.exception.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { RedisService } from '../../common/redis/redis.service.js';
import type { MemberContext, MemberRoleBrief } from '../../common/types/member-context.js';
import { parseDurationSeconds } from '../../common/utils/duration.js';
import { parseUserAgent } from '../../common/utils/request.js';
import {
  LOGIN_FAIL_PREFIX,
  LOGIN_LOCK_SECONDS,
  LOGIN_MAX_FAILURES,
  REFRESH_BLACKLIST_PREFIX,
  REFRESH_COOKIE,
} from './auth.constants.js';
import { CaptchaService } from './captcha.service.js';
import type { LoginDto } from './dto/login.dto.js';
import type { AccessTokenPayload, RefreshTokenPayload } from './types/token-payload.js';

/** 响应类型定义在 @club/shared，前端直接用同一份；这里再导出一次方便本模块内部引用 */
export type { LoginVo, ProfileVo } from '@club/shared';

export interface LoginResult {
  vo: LoginVo;
  refreshToken: string;
  refreshMaxAgeSeconds: number;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly redis: RedisService,
    private readonly captcha: CaptchaService,
    private readonly sysConfig: SysConfigService,
  ) {}

  // -------------------------------------------------------------------------
  // 登录
  // -------------------------------------------------------------------------

  async login(dto: LoginDto, ip: string, userAgent: string): Promise<LoginResult> {
    const { username, password } = dto;

    await this.assertNotLocked(username, ip);
    await this.captcha.verify(dto.captchaId, dto.captchaCode);

    const user = await this.prisma.client.user.findFirst({
      where: { username, deletedAt: 0n },
      select: {
        id: true,
        username: true,
        passwordHash: true,
        realName: true,
        avatarUrl: true,
        status: true,
      },
    });

    // 用户不存在与密码错误返回同一个错误码，不给撞库者区分依据
    if (user === null) {
      await this.recordFailure(username, ip, userAgent, '用户不存在');
      throw new BizException(ErrorCode.BAD_CREDENTIALS);
    }

    const passwordOk = await bcrypt.compare(password, user.passwordHash);
    if (!passwordOk) {
      await this.recordFailure(username, ip, userAgent, '密码错误');
      throw new BizException(ErrorCode.BAD_CREDENTIALS);
    }

    if (user.status === UserStatus.DISABLED) {
      await this.recordFailure(username, ip, userAgent, '账号已禁用');
      throw new BizException(ErrorCode.ACCOUNT_DISABLED);
    }
    if (user.status !== UserStatus.NORMAL) {
      await this.recordFailure(username, ip, userAgent, '账号状态异常');
      throw new BizException(ErrorCode.ACCOUNT_DISABLED, '账号尚未通过审核');
    }

    const { member, club, term } = await this.pickActiveMember(user.id);
    const context = await this.loadContext(user.id, member.id);

    await this.clearFailures(username, ip);
    await this.prisma.client.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date(), lastLoginIp: ip },
    });
    await this.writeLoginLog(user.id, username, ip, userAgent, 1, '登录成功');

    const access = await this.signAccessToken(context);
    const refresh = await this.signRefreshToken(context);

    return {
      vo: {
        accessToken: access.token,
        expiresIn: access.expiresIn,
        profile: this.toProfile(context, user.username, user.avatarUrl ?? null, club, term),
      },
      refreshToken: refresh.token,
      refreshMaxAgeSeconds: refresh.expiresIn,
    };
  }

  // -------------------------------------------------------------------------
  // 刷新与登出
  // -------------------------------------------------------------------------

  async refresh(refreshToken: string | undefined): Promise<{
    accessToken: string;
    expiresIn: number;
    profile: ProfileVo;
  }> {
    if (refreshToken === undefined || refreshToken === '') {
      throw new BizException(ErrorCode.REFRESH_TOKEN_MISSING);
    }

    let payload: RefreshTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<RefreshTokenPayload>(refreshToken, {
        secret: this.refreshSecret(),
      });
    } catch {
      throw new BizException(ErrorCode.TOKEN_EXPIRED, '登录状态已失效，请重新登录');
    }

    if (payload.typ !== 'refresh') {
      throw new BizException(ErrorCode.TOKEN_INVALID);
    }
    const blacklisted = await this.redis.get(`${REFRESH_BLACKLIST_PREFIX}${payload.jti}`);
    if (blacklisted !== null) {
      throw new BizException(ErrorCode.TOKEN_EXPIRED, '登录状态已失效，请重新登录');
    }

    const context = await this.loadContext(BigInt(payload.sub), BigInt(payload.mid));
    const user = await this.prisma.client.user.findUniqueOrThrow({
      where: { id: context.userId },
      select: { username: true, avatarUrl: true },
    });
    const { club, term } = await this.clubAndTerm(context.clubId, context.termId);

    const access = await this.signAccessToken(context);
    return {
      accessToken: access.token,
      expiresIn: access.expiresIn,
      profile: this.toProfile(context, user.username, user.avatarUrl ?? null, club, term),
    };
  }

  /** 登出：把 refresh 的 jti 拉黑到它自然过期为止，前端同时清掉内存里的 access */
  async logout(refreshToken: string | undefined): Promise<void> {
    if (refreshToken === undefined || refreshToken === '') return;
    try {
      const payload = await this.jwt.verifyAsync<RefreshTokenPayload>(refreshToken, {
        secret: this.refreshSecret(),
        ignoreExpiration: true,
      });
      if (payload.jti === undefined) return;
      const ttl = await this.ttlOfRefresh();
      await this.redis.set(`${REFRESH_BLACKLIST_PREFIX}${payload.jti}`, '1', ttl);
    } catch {
      // 已经无效的 token 直接忽略，登出必须是无副作用的
    }
  }

  // -------------------------------------------------------------------------
  // 上下文组装
  // -------------------------------------------------------------------------

  /** 供 JwtStrategy 调用：由 token 载荷还原登录者上下文，并校验状态仍然有效 */
  async buildContext(userId: bigint, memberId: bigint): Promise<MemberContext> {
    return this.loadContext(userId, memberId);
  }

  async getProfile(context: MemberContext): Promise<ProfileVo> {
    const user = await this.prisma.client.user.findUniqueOrThrow({
      where: { id: context.userId },
      select: { username: true, avatarUrl: true },
    });
    const { club, term } = await this.clubAndTerm(context.clubId, context.termId);
    return this.toProfile(context, user.username, user.avatarUrl ?? null, club, term);
  }

  private async loadContext(userId: bigint, memberId: bigint): Promise<MemberContext> {
    const member = await this.prisma.client.member.findFirst({
      where: { id: memberId, userId, deletedAt: 0n },
      include: {
        user: { select: { realName: true, status: true } },
        dept: { select: { id: true, name: true } },
        roles: { include: { role: true } },
      },
    });

    if (member === null) {
      throw new BizException(ErrorCode.MEMBER_PROFILE_MISSING);
    }
    if (member.status !== MemberStatus.ACTIVE) {
      throw new BizException(
        ErrorCode.ACCOUNT_DISABLED,
        `成员状态为「${member.status === MemberStatus.LEFT ? '退会' : member.status === MemberStatus.GRADUATED ? '毕业' : '冻结'}」，无法登录`,
      );
    }
    if (member.user.status !== UserStatus.NORMAL) {
      throw new BizException(ErrorCode.ACCOUNT_DISABLED);
    }

    const roles: MemberRoleBrief[] = member.roles.map(({ role }) => ({
      id: role.id,
      code: role.code,
      name: role.name,
      dataScope: role.dataScope as DataScope,
    }));

    const permissions = await this.loadPermissionCodes(roles.map((role) => role.id));
    // 多角色取最大范围（并集）
    const maxDataScope = roles.reduce<DataScope>(
      (max, role) => (role.dataScope > max ? role.dataScope : max),
      DataScope.SELF,
    );

    return {
      userId,
      memberId: member.id,
      clubId: member.clubId,
      termId: member.termId,
      deptId: member.deptId,
      deptName: member.dept?.name ?? null,
      memberNo: member.memberNo,
      realName: member.user.realName,
      position: member.position,
      permissions,
      roles,
      maxDataScope,
    };
  }

  private async loadPermissionCodes(roleIds: bigint[]): Promise<Set<string>> {
    if (roleIds.length === 0) return new Set();
    const rows = await this.prisma.client.rolePermission.findMany({
      where: { roleId: { in: roleIds } },
      include: { permission: { select: { code: true, status: true } } },
    });
    return new Set(
      rows.filter((row) => row.permission.status === 1).map((row) => row.permission.code),
    );
  }

  /** 登录时挑一个可用的成员身份：优先当前社团的当前届次 */
  private async pickActiveMember(userId: bigint): Promise<{
    member: { id: bigint; clubId: bigint; termId: bigint };
    club: { id: bigint; name: string; shortName: string | null };
    term: { id: bigint; name: string };
  }> {
    const club = await this.prisma.client.club.findFirst({
      where: { deletedAt: 0n },
      orderBy: { id: 'asc' },
      select: { id: true, name: true, shortName: true },
    });
    if (club === null) {
      throw new BizException(ErrorCode.CLUB_NOT_FOUND);
    }

    const member = await this.prisma.client.member.findFirst({
      where: { userId, clubId: club.id, deletedAt: 0n, status: MemberStatus.ACTIVE },
      orderBy: { id: 'desc' },
      select: { id: true, clubId: true, termId: true },
    });
    if (member === null) {
      throw new BizException(ErrorCode.MEMBER_PROFILE_MISSING, '该账号没有在册的社团成员身份');
    }

    const term = await this.prisma.client.term.findFirstOrThrow({
      where: { id: member.termId, deletedAt: 0n },
      select: { id: true, name: true },
    });
    return { member, club, term };
  }

  private async clubAndTerm(
    clubId: bigint,
    termId: bigint,
  ): Promise<{
    club: { id: bigint; name: string; shortName: string | null };
    term: { id: bigint; name: string };
  }> {
    const [club, term] = await Promise.all([
      this.prisma.client.club.findFirstOrThrow({
        where: { id: clubId },
        select: { id: true, name: true, shortName: true },
      }),
      this.prisma.client.term.findFirstOrThrow({
        where: { id: termId },
        select: { id: true, name: true },
      }),
    ]);
    return { club, term };
  }

  // -------------------------------------------------------------------------
  // 限流
  // -------------------------------------------------------------------------

  private async assertNotLocked(username: string, ip: string): Promise<void> {
    const keys = [`${LOGIN_FAIL_PREFIX}u:${username}`, `${LOGIN_FAIL_PREFIX}ip:${ip}`];
    for (const key of keys) {
      const raw = await this.redis.get(key);
      const count = raw === null ? 0 : Number.parseInt(raw, 10);
      if (count >= LOGIN_MAX_FAILURES) {
        const ttl = await this.redis.ttl(key);
        const minutes = ttl > 0 ? Math.ceil(ttl / 60) : Math.ceil(LOGIN_LOCK_SECONDS / 60);
        throw new BizException(
          ErrorCode.ACCOUNT_LOCKED,
          `失败次数过多，请 ${minutes} 分钟后再试`,
        );
      }
    }
  }

  private async recordFailure(
    username: string,
    ip: string,
    userAgent: string,
    reason: string,
  ): Promise<void> {
    await this.redis.incrWithTtl(`${LOGIN_FAIL_PREFIX}u:${username}`, LOGIN_LOCK_SECONDS);
    await this.redis.incrWithTtl(`${LOGIN_FAIL_PREFIX}ip:${ip}`, LOGIN_LOCK_SECONDS);
    await this.writeLoginLog(null, username, ip, userAgent, 2, reason);
  }

  private async clearFailures(username: string, ip: string): Promise<void> {
    await this.redis.del(`${LOGIN_FAIL_PREFIX}u:${username}`, `${LOGIN_FAIL_PREFIX}ip:${ip}`);
  }

  private async writeLoginLog(
    userId: bigint | null,
    username: string,
    ip: string,
    userAgent: string,
    status: number,
    msg: string,
  ): Promise<void> {
    const { browser, os } = parseUserAgent(userAgent);
    try {
      await this.prisma.client.loginLog.create({
        data: { userId, username, ip, browser, os, status, msg },
      });
    } catch (error) {
      // 登录日志写失败不能影响登录本身
      this.logger.warn(`写入登录日志失败：${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // -------------------------------------------------------------------------
  // token
  // -------------------------------------------------------------------------

  private accessSecret(): string {
    return this.config.get<string>('JWT_SECRET') ?? 'dev-only-change-me';
  }

  private refreshSecret(): string {
    return `${this.config.get<string>('JWT_SECRET') ?? 'dev-only-change-me'}:refresh`;
  }

  private ttlOfRefresh(): number {
    return parseDurationSeconds(this.config.get<string>('JWT_REFRESH_TTL'), 14 * 86400);
  }

  private async signAccessToken(context: MemberContext): Promise<{ token: string; expiresIn: number }> {
    const ttl = parseDurationSeconds(this.config.get<string>('JWT_ACCESS_TTL'), 2 * 3600);
    const payload: AccessTokenPayload = {
      sub: context.userId.toString(),
      mid: context.memberId.toString(),
      cid: context.clubId.toString(),
      tid: context.termId.toString(),
      typ: 'access',
    };
    const token = await this.jwt.signAsync(payload, { secret: this.accessSecret(), expiresIn: ttl });
    return { token, expiresIn: ttl };
  }

  private async signRefreshToken(context: MemberContext): Promise<{ token: string; expiresIn: number }> {
    const ttl = await this.ttlOfRefresh();
    const payload: RefreshTokenPayload = {
      sub: context.userId.toString(),
      mid: context.memberId.toString(),
      jti: randomUUID(),
      typ: 'refresh',
    };
    const token = await this.jwt.signAsync(payload, { secret: this.refreshSecret(), expiresIn: ttl });
    return { token, expiresIn: ttl };
  }

  // -------------------------------------------------------------------------
  // 映射
  // -------------------------------------------------------------------------

  private toProfile(
    context: MemberContext,
    username: string,
    avatarUrl: string | null,
    club: { id: bigint; name: string; shortName: string | null },
    term: { id: bigint; name: string },
  ): ProfileVo {
    return {
      userId: context.userId.toString(),
      username,
      realName: context.realName,
      avatarUrl,
      memberId: context.memberId.toString(),
      memberNo: context.memberNo,
      position: context.position,
      positionLabel:
        MEMBER_POSITION_LABEL[context.position as MemberPosition] ?? String(context.position),
      deptId: context.deptId?.toString() ?? null,
      deptName: context.deptName,
      clubId: context.clubId.toString(),
      clubName: club.name,
      clubShortName: club.shortName,
      termId: context.termId.toString(),
      termName: term.name,
      roles: context.roles.map((role) => ({
        id: role.id.toString(),
        code: role.code,
        name: role.name,
      })),
      permissions: [...context.permissions],
      maxDataScope: context.maxDataScope,
    };
  }
}
