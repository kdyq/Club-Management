import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { CurrentMember } from '../../common/decorators/current-member.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';
import type { MemberContext } from '../../common/types/member-context.js';
import { clientIp } from '../../common/utils/request.js';
import { AuthService, type LoginVo, type ProfileVo } from './auth.service.js';
import { REFRESH_COOKIE, REFRESH_COOKIE_PATH } from './auth.constants.js';
import { CaptchaService, type CaptchaResult } from './captcha.service.js';
import { LoginDto } from './dto/login.dto.js';

function refreshCookieOptions(maxAgeSeconds: number): {
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'lax';
  path: string;
  maxAge: number;
} {
  return {
    httpOnly: true,
    // 生产环境走 https 才带 Secure；本地 http 下带上会直接丢 cookie
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: REFRESH_COOKIE_PATH,
    maxAge: maxAgeSeconds * 1000,
  };
}

@ApiTags('认证')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly captchaService: CaptchaService,
  ) {}

  @Public()
  @Get('captcha')
  @ApiOperation({
    summary: '申请一个图形验证码',
    description: '只返回 captchaId，图形另走 GET /auth/captcha/:id/image。',
  })
  async captcha(): Promise<CaptchaResult> {
    return this.captchaService.create();
  }

  @Public()
  @Get('captcha/:captchaId/image')
  @Header('Content-Type', 'image/svg+xml')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate')
  @ApiOperation({ summary: '验证码图形', description: '以 SVG 图片返回，字符不会出现在页面 DOM 里。' })
  async captchaImage(
    @Param('captchaId') captchaId: string,
    @Res() response: Response,
  ): Promise<void> {
    const svg = await this.captchaService.renderImage(captchaId);
    if (svg === null) {
      response.status(HttpStatus.NOT_FOUND).send('');
      return;
    }
    response.status(HttpStatus.OK).send(svg);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '登录', description: '成功返回 accessToken，并把 refreshToken 写入 httpOnly Cookie' })
  async login(
    @Body() dto: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<LoginVo> {
    const result = await this.authService.login(
      dto,
      clientIp(request),
      request.headers['user-agent'] ?? '',
    );
    response.cookie(
      REFRESH_COOKIE,
      result.refreshToken,
      refreshCookieOptions(result.refreshMaxAgeSeconds),
    );
    return result.vo;
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '静默续期',
    description: '用 httpOnly Cookie 里的 refreshToken 换新的 accessToken。标为 Public，因为它靠 cookie 自身鉴权。',
  })
  async refresh(
    @Req() request: Request,
  ): Promise<{ accessToken: string; expiresIn: number; profile: ProfileVo }> {
    const token = (request.cookies as Record<string, string | undefined> | undefined)?.[
      REFRESH_COOKIE
    ];
    return this.authService.refresh(token);
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '登出', description: '把 refreshToken 拉黑并清除 Cookie' })
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<null> {
    const token = (request.cookies as Record<string, string | undefined> | undefined)?.[
      REFRESH_COOKIE
    ];
    await this.authService.logout(token);
    response.clearCookie(REFRESH_COOKIE, { path: REFRESH_COOKIE_PATH });
    return null;
  }

  @Get('profile')
  @ApiOperation({ summary: '当前登录者资料', description: '含角色、权限码与最大数据范围' })
  async profile(@CurrentMember() me: MemberContext): Promise<ProfileVo> {
    return this.authService.getProfile(me);
  }
}
