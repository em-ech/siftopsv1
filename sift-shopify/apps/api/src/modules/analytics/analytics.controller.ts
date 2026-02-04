import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { PrismaService } from '../../prisma.service';

@Controller('analytics')
export class AnalyticsController {
  private readonly logger = new Logger(AnalyticsController.name);

  constructor(
    private readonly analytics: AnalyticsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('summary')
  async getSummary(
    @Query('shop') shopDomain: string,
    @Query('days') daysStr?: string,
  ) {
    if (!shopDomain) {
      throw new BadRequestException('shop parameter is required');
    }

    const shop = await this.prisma.shop.findUnique({
      where: { shopDomain },
    });

    if (!shop) {
      throw new BadRequestException(`Shop not found: ${shopDomain}`);
    }

    const days = parseInt(daysStr || '7', 10);
    return this.analytics.getSummary(shop.id, days);
  }

  @Get('top-queries')
  async getTopQueries(
    @Query('shop') shopDomain: string,
    @Query('limit') limitStr?: string,
  ) {
    if (!shopDomain) {
      throw new BadRequestException('shop parameter is required');
    }

    const shop = await this.prisma.shop.findUnique({
      where: { shopDomain },
    });

    if (!shop) {
      throw new BadRequestException(`Shop not found: ${shopDomain}`);
    }

    const limit = Math.min(parseInt(limitStr || '20', 10), 100);
    return this.analytics.getTopQueries(shop.id, limit);
  }

  @Get('daily')
  async getDailyMetrics(
    @Query('shop') shopDomain: string,
    @Query('days') daysStr?: string,
  ) {
    if (!shopDomain) {
      throw new BadRequestException('shop parameter is required');
    }

    const shop = await this.prisma.shop.findUnique({
      where: { shopDomain },
    });

    if (!shop) {
      throw new BadRequestException(`Shop not found: ${shopDomain}`);
    }

    const days = parseInt(daysStr || '7', 10);
    return this.analytics.getDailyMetrics(shop.id, days);
  }

  @Post('click')
  async recordClick(
    @Body() body: { searchEventId: string; variantId: string },
  ) {
    const { searchEventId, variantId } = body;

    if (!searchEventId || !variantId) {
      throw new BadRequestException('searchEventId and variantId are required');
    }

    await this.analytics.recordClick(searchEventId, variantId);
    return { success: true };
  }

  @Post('purchase')
  async recordPurchase(
    @Body() body: { searchEventId: string; variantId: string; revenue: number },
  ) {
    const { searchEventId, variantId, revenue } = body;

    if (!searchEventId || !variantId || revenue === undefined) {
      throw new BadRequestException('searchEventId, variantId, and revenue are required');
    }

    await this.analytics.recordPurchase(searchEventId, variantId, revenue);
    return { success: true };
  }
}
