import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { MemberVo, PageResult } from '@club/shared';
import { CurrentMember } from '../../common/decorators/current-member.decorator.js';
import { RequirePerm } from '../../common/decorators/require-perm.decorator.js';
import type { MemberContext } from '../../common/types/member-context.js';
import { QueryMemberDto } from './dto/query-member.dto.js';
import { MemberService } from './member.service.js';

@ApiTags('成员')
@Controller('members')
export class MemberController {
  constructor(private readonly memberService: MemberService) {}

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
}
