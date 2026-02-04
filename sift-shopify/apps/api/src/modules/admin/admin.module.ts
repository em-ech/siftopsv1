import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { IngestModule } from '../ingest/ingest.module';
import { AnalyticsModule } from '../analytics/analytics.module';

@Module({
  imports: [IngestModule, AnalyticsModule],
  controllers: [AdminController],
})
export class AdminModule {}
