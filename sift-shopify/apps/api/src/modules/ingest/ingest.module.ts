import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { IngestService } from './ingest.service';
import { IngestProcessor } from './ingest.processor';
import { WebhooksController } from './webhooks.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'ingest',
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 1000,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
      },
    }),
    AuthModule,
  ],
  controllers: [WebhooksController],
  providers: [IngestService, IngestProcessor],
  exports: [IngestService],
})
export class IngestModule {}
