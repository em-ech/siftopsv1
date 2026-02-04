import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { SearchVariant } from '@prisma/client';

export interface RecordSearchEventParams {
  shopId: string;
  query: string;
  sessionId?: string;
  variant: 'control' | 'treatment';
  region?: string;
  results: string[];
  resultCount: number;
}

export interface SearchEventRecord {
  id: string;
  createdAt: Date;
}

export interface AnalyticsSummary {
  totalSearches: number;
  totalClicks: number;
  totalPurchases: number;
  totalRevenue: number;
  clickThroughRate: number;
  conversionRate: number;
  averageOrderValue: number;
  controlSearches: number;
  treatmentSearches: number;
  controlClicks: number;
  treatmentClicks: number;
  controlPurchases: number;
  treatmentPurchases: number;
}

export interface TopQuery {
  query: string;
  searchCount: number;
  clickCount: number;
  purchaseCount: number;
  ctr: number;
}

export interface DailyMetrics {
  date: string;
  searches: number;
  clicks: number;
  purchases: number;
  revenue: number;
  variant: 'control' | 'treatment';
}

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async recordSearchEvent(params: RecordSearchEventParams): Promise<SearchEventRecord> {
    const event = await this.prisma.searchEvent.create({
      data: {
        shopId: params.shopId,
        query: params.query,
        sessionId: params.sessionId,
        variant: params.variant === 'control' ? SearchVariant.CONTROL : SearchVariant.TREATMENT,
        region: params.region,
        results: params.results,
        resultCount: params.resultCount,
      },
    });

    return {
      id: event.id,
      createdAt: event.createdAt,
    };
  }

  async recordClick(searchEventId: string, variantId: string): Promise<void> {
    await this.prisma.searchEvent.update({
      where: { id: searchEventId },
      data: { clickedVariantId: variantId },
    });
  }

  async recordPurchase(searchEventId: string, variantId: string, revenue: number): Promise<void> {
    await this.prisma.searchEvent.update({
      where: { id: searchEventId },
      data: {
        purchasedVariantId: variantId,
        revenue,
      },
    });
  }

  async getSummary(shopId: string, days: number = 7): Promise<AnalyticsSummary> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const events = await this.prisma.searchEvent.findMany({
      where: {
        shopId,
        createdAt: { gte: startDate },
      },
      select: {
        variant: true,
        clickedVariantId: true,
        purchasedVariantId: true,
        revenue: true,
      },
    });

    const totalSearches = events.length;
    const totalClicks = events.filter(e => e.clickedVariantId).length;
    const totalPurchases = events.filter(e => e.purchasedVariantId).length;
    const totalRevenue = events.reduce((sum, e) => sum + (e.revenue?.toNumber() || 0), 0);

    const controlEvents = events.filter(e => e.variant === SearchVariant.CONTROL);
    const treatmentEvents = events.filter(e => e.variant === SearchVariant.TREATMENT);

    return {
      totalSearches,
      totalClicks,
      totalPurchases,
      totalRevenue,
      clickThroughRate: totalSearches > 0 ? totalClicks / totalSearches : 0,
      conversionRate: totalSearches > 0 ? totalPurchases / totalSearches : 0,
      averageOrderValue: totalPurchases > 0 ? totalRevenue / totalPurchases : 0,
      controlSearches: controlEvents.length,
      treatmentSearches: treatmentEvents.length,
      controlClicks: controlEvents.filter(e => e.clickedVariantId).length,
      treatmentClicks: treatmentEvents.filter(e => e.clickedVariantId).length,
      controlPurchases: controlEvents.filter(e => e.purchasedVariantId).length,
      treatmentPurchases: treatmentEvents.filter(e => e.purchasedVariantId).length,
    };
  }

  async getTopQueries(shopId: string, limit: number = 20): Promise<TopQuery[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);

    const results = await this.prisma.$queryRaw<Array<{
      query: string;
      search_count: bigint;
      click_count: bigint;
      purchase_count: bigint;
    }>>`
      SELECT
        query,
        COUNT(*) as search_count,
        COUNT(clicked_variant_id) as click_count,
        COUNT(purchased_variant_id) as purchase_count
      FROM search_events
      WHERE shop_id = ${shopId}
        AND created_at >= ${startDate}
      GROUP BY query
      ORDER BY search_count DESC
      LIMIT ${limit}
    `;

    return results.map(r => ({
      query: r.query,
      searchCount: Number(r.search_count),
      clickCount: Number(r.click_count),
      purchaseCount: Number(r.purchase_count),
      ctr: Number(r.search_count) > 0 ? Number(r.click_count) / Number(r.search_count) : 0,
    }));
  }

  async getDailyMetrics(shopId: string, days: number = 7): Promise<DailyMetrics[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const results = await this.prisma.$queryRaw<Array<{
      date: Date;
      variant: string;
      searches: bigint;
      clicks: bigint;
      purchases: bigint;
      revenue: number | null;
    }>>`
      SELECT
        DATE(created_at) as date,
        variant,
        COUNT(*) as searches,
        COUNT(clicked_variant_id) as clicks,
        COUNT(purchased_variant_id) as purchases,
        SUM(revenue) as revenue
      FROM search_events
      WHERE shop_id = ${shopId}
        AND created_at >= ${startDate}
      GROUP BY DATE(created_at), variant
      ORDER BY date ASC, variant
    `;

    return results.map(r => ({
      date: r.date.toISOString().split('T')[0],
      searches: Number(r.searches),
      clicks: Number(r.clicks),
      purchases: Number(r.purchases),
      revenue: r.revenue || 0,
      variant: r.variant === 'CONTROL' ? 'control' : 'treatment',
    }));
  }
}
