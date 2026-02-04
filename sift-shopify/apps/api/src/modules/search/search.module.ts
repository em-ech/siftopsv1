import { Module, forwardRef } from '@nestjs/common';
import { SearchService } from './search.service';
import { SearchController } from './search.controller';
import { ProxyController } from './proxy.controller';
import { AnalyticsModule } from '../analytics/analytics.module';

@Module({
  imports: [forwardRef(() => AnalyticsModule)],
  controllers: [SearchController, ProxyController],
  providers: [SearchService],
  exports: [SearchService],
})
export class SearchModule {}
