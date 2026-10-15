import { Global, Module } from '@nestjs/common';
import { SysConfigService } from './sys-config.service.js';

@Global()
@Module({
  providers: [SysConfigService],
  exports: [SysConfigService],
})
export class SysConfigModule {}
