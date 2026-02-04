import {
  Controller,
  Post,
  Req,
  Res,
  Headers,
  Logger,
  RawBodyRequest,
  UnauthorizedException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ShopifyService } from '../shopify/shopify.service';
import { AuthService } from '../auth/auth.service';
import { config } from '../../env';

@Controller('webhooks')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(
    private readonly shopify: ShopifyService,
    private readonly auth: AuthService,
    @InjectQueue('ingest') private readonly ingestQueue: Queue,
  ) {}

  @Post()
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Res() res: Response,
    @Headers('x-shopify-topic') topic: string,
    @Headers('x-shopify-hmac-sha256') hmac: string,
    @Headers('x-shopify-shop-domain') shopDomain: string,
    @Headers('x-shopify-webhook-id') webhookId: string,
  ): Promise<void> {
    // Respond immediately to Shopify
    res.status(200).send();

    // Skip verification in demo mode
    if (!config.DEMO_MODE) {
      // Verify webhook signature
      const rawBody = req.rawBody;
      if (!rawBody || !this.shopify.verifyWebhookSignature(rawBody, hmac)) {
        this.logger.warn(`Invalid webhook signature from ${shopDomain}`);
        throw new UnauthorizedException('Invalid webhook signature');
      }
    }

    const payload = req.body;

    this.logger.log(`Received webhook: ${topic} from ${shopDomain}`);

    // Queue webhook for processing with idempotency key
    const jobId = `webhook:${webhookId}`;

    try {
      await this.ingestQueue.add(
        topic,
        {
          shopDomain,
          webhookId,
          topic,
          payload,
        },
        {
          jobId,
          removeOnComplete: 100,
          removeOnFail: 1000,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 1000,
          },
        },
      );
    } catch (error) {
      // Job already exists (duplicate webhook)
      if ((error as Error).message.includes('Job already exists')) {
        this.logger.log(`Duplicate webhook ignored: ${webhookId}`);
      } else {
        throw error;
      }
    }
  }
}
