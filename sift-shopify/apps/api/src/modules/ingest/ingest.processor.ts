import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { IngestService } from './ingest.service';
import { AuthService } from '../auth/auth.service';

interface WebhookJob {
  shopDomain: string;
  webhookId: string;
  topic: string;
  payload: any;
}

@Processor('ingest', {
  concurrency: 5,
  limiter: {
    max: 10,
    duration: 1000, // 10 jobs per second
  },
})
export class IngestProcessor extends WorkerHost {
  private readonly logger = new Logger(IngestProcessor.name);

  constructor(
    private readonly ingestService: IngestService,
    private readonly authService: AuthService,
  ) {
    super();
  }

  async process(job: Job<WebhookJob>): Promise<void> {
    const { shopDomain, webhookId, topic, payload } = job.data;

    this.logger.log(`Processing webhook: ${topic} for ${shopDomain} (job ${job.id})`);

    try {
      switch (topic) {
        case 'products/create':
        case 'products/update':
        case 'PRODUCTS_CREATE':
        case 'PRODUCTS_UPDATE':
          await this.ingestService.processProductWebhook(shopDomain, webhookId, payload);
          break;

        case 'products/delete':
        case 'PRODUCTS_DELETE':
          const productId = payload.id
            ? `gid://shopify/Product/${payload.id}`
            : payload.admin_graphql_api_id;
          await this.ingestService.processProductDeleteWebhook(shopDomain, webhookId, productId);
          break;

        case 'inventory_levels/update':
        case 'INVENTORY_LEVELS_UPDATE':
          await this.ingestService.processInventoryWebhook(shopDomain, webhookId, payload);
          break;

        case 'app/uninstalled':
        case 'APP_UNINSTALLED':
          await this.authService.handleUninstall(shopDomain);
          break;

        default:
          this.logger.warn(`Unknown webhook topic: ${topic}`);
      }
    } catch (error) {
      this.logger.error(`Failed to process webhook ${topic}:`, error);
      throw error;
    }
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<WebhookJob>): void {
    this.logger.log(`Webhook job ${job.id} completed`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<WebhookJob> | undefined, error: Error): void {
    this.logger.error(`Webhook job ${job?.id} failed:`, error.message);
  }
}
