import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ErrorCode } from '@club/shared';
import { BizException } from '../../../common/exceptions/biz.exception.js';
import type { MemberContext } from '../../../common/types/member-context.js';
import { AuthService } from '../auth.service.js';
import type { AccessTokenPayload } from '../types/token-payload.js';

/**
 * access token 校验。通过后把 MemberContext 挂到 req.member 上，
 * @CurrentMember() 从这里取。
 *
 * 每个请求都会查库重新组装上下文（成员状态、角色、权限），
 * 这样改权限、冻结成员能立刻生效，代价是每个请求多两次小表查询——
 * 社团级数据量下完全划算，比缓存带来的「改了不生效」要值。
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET') ?? 'dev-only-change-me',
    });
  }

  async validate(payload: AccessTokenPayload): Promise<MemberContext> {
    if (payload.typ !== 'access') {
      throw new BizException(ErrorCode.TOKEN_INVALID);
    }
    try {
      return await this.authService.buildContext(BigInt(payload.sub), BigInt(payload.mid));
    } catch (error) {
      // 成员被冻结、退出、删除都会走到这里，统一按「登录已失效」处理
      if (error instanceof BizException) throw error;
      throw new BizException(ErrorCode.TOKEN_INVALID);
    }
  }
}
