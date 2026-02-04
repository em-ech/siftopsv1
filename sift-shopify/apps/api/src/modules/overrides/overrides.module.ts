import { Module } from '@nestjs/common';
import { OverridesService } from './overrides.service';
import { OverridesController } from './overrides.controller';

@Module({
  controllers: [OverridesController],
  providers: [OverridesService],
  exports: [OverridesService],
})
export class OverridesModule {}
