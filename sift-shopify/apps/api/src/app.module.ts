import { Module, NestModule, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma.module';
import { config } from './env';

// Core modules
import { EncryptionModule } from './modules/encryption/encryption.module';
import { EmbeddingsModule } from './modules/embeddings/embeddings.module';
import { ShopifyModule } from './modules/shopify/shopify.module';

// Feature modules
import { AuthModule } from './modules/auth/auth.module';
import { IngestModule } from './modules/ingest/ingest.module';
import { SearchModule } from './modules/search/search.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { OverridesModule } from './modules/overrides/overrides.module';
import { HealthModule } from './modules/health/health.module';
import { AdminModule } from './modules/admin/admin.module';

import * as bodyParser from 'body-parser';

@Module({
  imports: [
    // Database
    PrismaModule,

    // Queue configuration
    BullModule.forRoot({
      connection: {
        host: new URL(config.REDIS_URL).hostname,
        port: parseInt(new URL(config.REDIS_URL).port || '6379', 10),
      },
    }),

    // Scheduler
    ScheduleModule.forRoot(),

    // Core
    EncryptionModule,
    EmbeddingsModule,
    ShopifyModule,

    // Features
    AuthModule,
    IngestModule,
    SearchModule,
    AnalyticsModule,
    OverridesModule,
    HealthModule,
    AdminModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Raw body parser for webhook signature verification
    consumer
      .apply(
        bodyParser.json({
          verify: (req: any, res, buf) => {
            req.rawBody = buf;
          },
        }),
      )
      .forRoutes({ path: 'webhooks', method: RequestMethod.POST });
  }
}
