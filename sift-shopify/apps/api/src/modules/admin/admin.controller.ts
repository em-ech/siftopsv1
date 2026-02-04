import {
  Controller,
  Get,
  Post,
  Query,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { IngestService } from '../ingest/ingest.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { PrismaService } from '../../prisma.service';

@Controller('admin')
export class AdminController {
  private readonly logger = new Logger(AdminController.name);

  constructor(
    private readonly ingestService: IngestService,
    private readonly analytics: AnalyticsService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('backfill')
  async startBackfill(@Query('shop') shopDomain: string) {
    if (!shopDomain) {
      throw new BadRequestException('shop parameter is required');
    }

    this.logger.log(`Starting backfill for ${shopDomain}`);

    const operationId = await this.ingestService.startBackfill(shopDomain);

    return {
      success: true,
      operationId,
      message: 'Backfill started. Poll /admin/status for progress.',
    };
  }

  @Get('status')
  async getStatus(@Query('shop') shopDomain: string) {
    if (!shopDomain) {
      throw new BadRequestException('shop parameter is required');
    }

    const status = await this.ingestService.getSyncStatus(shopDomain);

    // Also get last webhook info
    const lastWebhook = await this.prisma.webhookLog.findFirst({
      where: { shopDomain },
      orderBy: { createdAt: 'desc' },
      select: {
        topic: true,
        createdAt: true,
        processed: true,
      },
    });

    return {
      ...status,
      lastWebhook: lastWebhook ? {
        topic: lastWebhook.topic,
        receivedAt: lastWebhook.createdAt,
        processed: lastWebhook.processed,
      } : null,
    };
  }

  @Get('poll-backfill')
  async pollBackfill(@Query('shop') shopDomain: string) {
    if (!shopDomain) {
      throw new BadRequestException('shop parameter is required');
    }

    return this.ingestService.pollBulkOperation(shopDomain);
  }

  @Get('metrics/summary')
  async getMetricsSummary(
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

  @Get('metrics/top-queries')
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

  @Get('shops')
  async listShops() {
    const shops = await this.prisma.shop.findMany({
      select: {
        id: true,
        shopDomain: true,
        installedAt: true,
        uninstalledAt: true,
        syncStatus: true,
        lastSyncAt: true,
        _count: {
          select: { variants: true },
        },
      },
      orderBy: { installedAt: 'desc' },
    });

    return shops.map(shop => ({
      id: shop.id,
      shopDomain: shop.shopDomain,
      installedAt: shop.installedAt,
      uninstalledAt: shop.uninstalledAt,
      syncStatus: shop.syncStatus,
      lastSyncAt: shop.lastSyncAt,
      variantCount: shop._count.variants,
    }));
  }

  @Get('variants')
  async listVariants(
    @Query('shop') shopDomain: string,
    @Query('limit') limitStr?: string,
    @Query('offset') offsetStr?: string,
    @Query('search') search?: string,
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

    const limit = Math.min(parseInt(limitStr || '50', 10), 200);
    const offset = parseInt(offsetStr || '0', 10);

    const where: any = { shopId: shop.id };
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { variantTitle: { contains: search, mode: 'insensitive' } },
        { vendor: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [variants, total] = await Promise.all([
      this.prisma.productVariant.findMany({
        where,
        select: {
          id: true,
          variantId: true,
          productId: true,
          handle: true,
          title: true,
          variantTitle: true,
          vendor: true,
          productType: true,
          price: true,
          available: true,
          inventoryQuantity: true,
          imageUrl: true,
        },
        take: limit,
        skip: offset,
        orderBy: { title: 'asc' },
      }),
      this.prisma.productVariant.count({ where }),
    ]);

    return {
      variants,
      total,
      limit,
      offset,
    };
  }
}
