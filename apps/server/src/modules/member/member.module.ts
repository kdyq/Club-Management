import { Module } from '@nestjs/common';
import { TermModule } from '../term/term.module.js';
import { MemberController } from './member.controller.js';
import { MemberExcelService } from './member-excel.service.js';
import { MemberService } from './member.service.js';
import { MemberWriteService } from './member-write.service.js';

@Module({
  imports: [TermModule],
  controllers: [MemberController],
  providers: [MemberService, MemberWriteService, MemberExcelService],
  exports: [MemberService, MemberWriteService],
})
export class MemberModule {}
