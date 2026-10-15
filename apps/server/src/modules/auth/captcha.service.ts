/**
 * 图形验证码。自己生成 SVG，不引第三方图形库。
 *
 * 答案存 Redis（5 分钟），校验后立刻删除，避免同一答案被反复使用。
 * 是否强制校验由 sys_config 的 auth.captcha.enabled 控制，默认开启。
 */
import { randomInt, randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ErrorCode } from '@club/shared';
import { SysConfigService } from '../../common/config/sys-config.service.js';
import { BizException } from '../../common/exceptions/biz.exception.js';
import { RedisService } from '../../common/redis/redis.service.js';
import { CAPTCHA_LENGTH, CAPTCHA_PREFIX, CAPTCHA_TTL_SECONDS } from './auth.constants.js';

/** 去掉了 0/O/1/I/l 这些容易看混的字符 */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

const CANVAS_WIDTH = 120;
const CANVAS_HEIGHT = 40;

function randomCode(length: number): string {
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += ALPHABET[randomInt(0, ALPHABET.length)];
  }
  return out;
}

function renderSvg(code: string): string {
  const charWidth = CANVAS_WIDTH / (code.length + 1);
  const glyphs = code
    .split('')
    .map((char, index) => {
      const x = charWidth * (index + 1);
      const y = CANVAS_HEIGHT / 2 + randomInt(-2, 3);
      const rotate = randomInt(-24, 25);
      const size = randomInt(22, 27);
      const shade = randomInt(40, 110);
      return `<text x="${x}" y="${y}" font-size="${size}" font-family="monospace" font-weight="700"
        fill="rgb(${shade},${shade + 10},${shade + 40})" text-anchor="middle"
        dominant-baseline="middle" transform="rotate(${rotate} ${x} ${y})">${char}</text>`;
    })
    .join('');

  const lines = Array.from({ length: 4 }, () => {
    const shade = randomInt(150, 200);
    return `<line x1="${randomInt(0, CANVAS_WIDTH)}" y1="${randomInt(0, CANVAS_HEIGHT)}"
      x2="${randomInt(0, CANVAS_WIDTH)}" y2="${randomInt(0, CANVAS_HEIGHT)}"
      stroke="rgb(${shade},${shade},${shade + 20})" stroke-width="1"/>`;
  }).join('');

  const dots = Array.from({ length: 24 }, () => {
    const shade = randomInt(150, 210);
    return `<circle cx="${randomInt(0, CANVAS_WIDTH)}" cy="${randomInt(0, CANVAS_HEIGHT)}"
      r="1" fill="rgb(${shade},${shade},${shade})"/>`;
  }).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS_WIDTH}" height="${CANVAS_HEIGHT}" viewBox="0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}">
  <rect width="${CANVAS_WIDTH}" height="${CANVAS_HEIGHT}" fill="rgb(245,246,248)"/>
  ${lines}${dots}${glyphs}
</svg>`;
}

export interface CaptchaResult {
  captchaId: string;
  svg: string;
  enabled: boolean;
}

@Injectable()
export class CaptchaService {
  constructor(
    private readonly redis: RedisService,
    private readonly sysConfig: SysConfigService,
  ) {}

  async isEnabled(): Promise<boolean> {
    return this.sysConfig.getBool('auth.captcha.enabled', true);
  }

  async create(): Promise<CaptchaResult> {
    const enabled = await this.isEnabled();
    if (!enabled) {
      return { captchaId: '', svg: '', enabled: false };
    }

    const code = randomCode(CAPTCHA_LENGTH);
    const captchaId = randomUUID();
    await this.redis.set(`${CAPTCHA_PREFIX}${captchaId}`, code.toLowerCase(), CAPTCHA_TTL_SECONDS);
    return { captchaId, svg: renderSvg(code), enabled: true };
  }

  /** 校验并消费验证码。验证码关闭时直接放行。 */
  async verify(captchaId: string | undefined, input: string | undefined): Promise<void> {
    if (!(await this.isEnabled())) return;

    if (captchaId === undefined || input === undefined || captchaId === '' || input === '') {
      throw new BizException(ErrorCode.PARAM_INVALID, '请输入图形验证码');
    }

    const key = `${CAPTCHA_PREFIX}${captchaId}`;
    const expected = await this.redis.get(key);
    // 无论对错都消费掉，避免拿一个 id 反复试
    await this.redis.del(key);

    if (expected === null) {
      throw new BizException(ErrorCode.CAPTCHA_INVALID);
    }
    if (expected !== input.trim().toLowerCase()) {
      throw new BizException(ErrorCode.CAPTCHA_INVALID);
    }
  }
}
