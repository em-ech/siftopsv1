import { Injectable, Logger, UnauthorizedException, BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';
import { config } from '../../env';

export interface ShopifyWebhookHeaders {
  'x-shopify-topic': string;
  'x-shopify-hmac-sha256': string;
  'x-shopify-shop-domain': string;
  'x-shopify-webhook-id': string;
  'x-shopify-api-version': string;
}

interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{ message: string }>;
  extensions?: {
    cost: {
      requestedQueryCost: number;
      actualQueryCost: number;
      throttleStatus: {
        maximumAvailable: number;
        currentlyAvailable: number;
        restoreRate: number;
      };
    };
  };
}

@Injectable()
export class ShopifyService {
  private readonly logger = new Logger(ShopifyService.name);
  private readonly apiVersion = '2024-01';

  // Validate shop domain format
  validateShopDomain(shop: string): boolean {
    const shopRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/;
    return shopRegex.test(shop);
  }

  // Generate OAuth authorization URL
  generateAuthUrl(shop: string, state: string, redirectUri: string): string {
    if (!this.validateShopDomain(shop)) {
      throw new BadRequestException('Invalid shop domain format');
    }

    const params = new URLSearchParams({
      client_id: config.SHOPIFY_API_KEY,
      scope: config.SHOPIFY_SCOPES,
      redirect_uri: redirectUri,
      state,
      'grant_options[]': 'offline',
    });

    return `https://${shop}/admin/oauth/authorize?${params.toString()}`;
  }

  // Exchange authorization code for access token
  async exchangeCodeForToken(shop: string, code: string): Promise<string> {
    if (!this.validateShopDomain(shop)) {
      throw new BadRequestException('Invalid shop domain format');
    }

    const response = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: config.SHOPIFY_API_KEY,
        client_secret: config.SHOPIFY_API_SECRET,
        code,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      this.logger.error(`Failed to exchange code for token: ${error}`);
      throw new UnauthorizedException('Failed to obtain access token');
    }

    const data = await response.json();
    return data.access_token;
  }

  // Verify webhook HMAC signature
  verifyWebhookSignature(rawBody: Buffer, hmacHeader: string): boolean {
    const hmac = crypto
      .createHmac('sha256', config.SHOPIFY_API_SECRET)
      .update(rawBody)
      .digest('base64');

    return crypto.timingSafeEqual(
      Buffer.from(hmac),
      Buffer.from(hmacHeader)
    );
  }

  // Verify App Proxy signature
  verifyAppProxySignature(query: Record<string, string>): boolean {
    const { signature, ...params } = query;

    if (!signature) {
      return false;
    }

    // Sort parameters and create query string
    const sortedKeys = Object.keys(params).sort();
    const message = sortedKeys
      .map(key => `${key}=${params[key]}`)
      .join('');

    const calculatedSignature = crypto
      .createHmac('sha256', config.SHOPIFY_API_SECRET)
      .update(message)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(calculatedSignature),
      Buffer.from(signature)
    );
  }

  // Make GraphQL API call with rate limiting awareness
  async graphql<T>(
    shop: string,
    accessToken: string,
    query: string,
    variables?: Record<string, unknown>
  ): Promise<GraphQLResponse<T>> {
    const response = await fetch(
      `https://${shop}/admin/api/${this.apiVersion}/graphql.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': accessToken,
        },
        body: JSON.stringify({ query, variables }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        // Rate limited - extract retry-after
        const retryAfter = response.headers.get('Retry-After') || '1';
        throw new Error(`RATE_LIMITED:${retryAfter}`);
      }
      const error = await response.text();
      throw new Error(`GraphQL request failed: ${error}`);
    }

    return response.json();
  }

  // Register webhooks
  async registerWebhooks(shop: string, accessToken: string): Promise<void> {
    const webhookTopics = [
      'PRODUCTS_CREATE',
      'PRODUCTS_UPDATE',
      'PRODUCTS_DELETE',
      'INVENTORY_LEVELS_UPDATE',
      'APP_UNINSTALLED',
    ];

    const callbackUrl = `${config.APP_URL}/webhooks`;

    for (const topic of webhookTopics) {
      const query = `
        mutation webhookSubscriptionCreate($topic: WebhookSubscriptionTopic!, $webhookSubscription: WebhookSubscriptionInput!) {
          webhookSubscriptionCreate(topic: $topic, webhookSubscription: $webhookSubscription) {
            webhookSubscription {
              id
            }
            userErrors {
              field
              message
            }
          }
        }
      `;

      try {
        const result = await this.graphql(shop, accessToken, query, {
          topic,
          webhookSubscription: {
            callbackUrl,
            format: 'JSON',
          },
        });

        this.logger.log(`Registered webhook for ${topic} on ${shop}`);
      } catch (error) {
        this.logger.error(`Failed to register webhook ${topic} on ${shop}:`, error);
      }
    }
  }

  // Start bulk operation for product export
  async startBulkOperation(shop: string, accessToken: string): Promise<string> {
    const query = `
      mutation bulkOperationRunQuery($query: String!) {
        bulkOperationRunQuery(query: $query) {
          bulkOperation {
            id
            status
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const bulkQuery = `
      {
        products {
          edges {
            node {
              id
              handle
              title
              vendor
              productType
              tags
              status
              metafields(first: 10) {
                edges {
                  node {
                    namespace
                    key
                    value
                  }
                }
              }
              collections(first: 50) {
                edges {
                  node {
                    title
                  }
                }
              }
              variants(first: 100) {
                edges {
                  node {
                    id
                    title
                    price
                    compareAtPrice
                    availableForSale
                    inventoryQuantity
                    selectedOptions {
                      name
                      value
                    }
                    image {
                      url
                    }
                  }
                }
              }
            }
          }
        }
      }
    `;

    const result = await this.graphql<{
      bulkOperationRunQuery: {
        bulkOperation: { id: string; status: string } | null;
        userErrors: Array<{ field: string; message: string }>;
      };
    }>(shop, accessToken, query, { query: bulkQuery });

    if (result.data?.bulkOperationRunQuery.userErrors?.length) {
      const errors = result.data.bulkOperationRunQuery.userErrors;
      throw new Error(`Bulk operation failed: ${errors.map(e => e.message).join(', ')}`);
    }

    if (!result.data?.bulkOperationRunQuery.bulkOperation?.id) {
      throw new Error('Failed to start bulk operation');
    }

    return result.data.bulkOperationRunQuery.bulkOperation.id;
  }

  // Poll bulk operation status
  async getBulkOperationStatus(shop: string, accessToken: string): Promise<{
    status: string;
    url: string | null;
    errorCode: string | null;
    objectCount: number | null;
  }> {
    const query = `
      {
        currentBulkOperation {
          id
          status
          url
          errorCode
          objectCount
        }
      }
    `;

    const result = await this.graphql<{
      currentBulkOperation: {
        id: string;
        status: string;
        url: string | null;
        errorCode: string | null;
        objectCount: number | null;
      } | null;
    }>(shop, accessToken, query);

    if (!result.data?.currentBulkOperation) {
      return {
        status: 'NOT_FOUND',
        url: null,
        errorCode: null,
        objectCount: null,
      };
    }

    return {
      status: result.data.currentBulkOperation.status,
      url: result.data.currentBulkOperation.url,
      errorCode: result.data.currentBulkOperation.errorCode,
      objectCount: result.data.currentBulkOperation.objectCount,
    };
  }

  // Fetch JSONL results from bulk operation
  async fetchBulkResults(url: string): Promise<string> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch bulk results: ${response.statusText}`);
    }
    return response.text();
  }
}
