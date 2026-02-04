import {
  Controller,
  Get,
  Query,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { SearchService, SearchResult } from './search.service';
import { PrismaService } from '../../prisma.service';
import { AnalyticsService } from '../analytics/analytics.service';

interface SearchResponse {
  results: SearchResult[];
  query: string;
  totalResults: number;
  variant: 'control' | 'treatment';
  searchEventId?: string;
}

@Controller('search')
export class SearchController {
  private readonly logger = new Logger(SearchController.name);

  constructor(
    private readonly searchService: SearchService,
    private readonly prisma: PrismaService,
    private readonly analytics: AnalyticsService,
  ) {}

  @Get()
  async search(
    @Query('shop') shopDomain: string,
    @Query('q') query: string,
    @Query('limit') limitStr?: string,
    @Query('variant') variant?: 'control' | 'treatment',
    @Query('product_type') productType?: string,
    @Query('region') region?: string,
    @Query('session_id') sessionId?: string,
    @Query('record_event') recordEvent?: string,
  ): Promise<SearchResponse> {
    if (!shopDomain) {
      throw new BadRequestException('shop parameter is required');
    }

    if (!query || query.trim().length === 0) {
      throw new BadRequestException('q parameter is required');
    }

    // Find shop
    const shop = await this.prisma.shop.findUnique({
      where: { shopDomain },
    });

    if (!shop) {
      throw new BadRequestException(`Shop not found: ${shopDomain}`);
    }

    const limit = Math.min(parseInt(limitStr || '20', 10), 100);
    const searchVariant = variant || 'treatment';

    const results = await this.searchService.search({
      shopId: shop.id,
      query: query.trim(),
      limit,
      availableOnly: true,
      productType,
      region,
      sessionId,
      variant: searchVariant,
    });

    // Record search event if requested
    let searchEventId: string | undefined;
    if (recordEvent === 'true' || recordEvent === '1') {
      const event = await this.analytics.recordSearchEvent({
        shopId: shop.id,
        query: query.trim(),
        sessionId,
        variant: searchVariant,
        region,
        results: results.map(r => r.variantId),
        resultCount: results.length,
      });
      searchEventId = event.id;
    }

    return {
      results,
      query: query.trim(),
      totalResults: results.length,
      variant: searchVariant,
      searchEventId,
    };
  }
}
