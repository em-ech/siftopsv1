import { Injectable, Logger, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../../prisma.service';
import { ShopifyService } from '../shopify/shopify.service';
import { EncryptionService } from '../encryption/encryption.service';
import { config } from '../../env';

interface OAuthState {
  nonce: string;
  shop: string;
  timestamp: number;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  // In production, use Redis for state storage
  private readonly stateStore = new Map<string, OAuthState>();
  private readonly stateExpiry = 10 * 60 * 1000; // 10 minutes

  constructor(
    private readonly prisma: PrismaService,
    private readonly shopify: ShopifyService,
    private readonly encryption: EncryptionService,
  ) {}

  // Initiate OAuth flow
  initiateOAuth(shop: string): { authUrl: string; state: string } {
    if (!this.shopify.validateShopDomain(shop)) {
      throw new BadRequestException('Invalid shop domain format');
    }

    const nonce = uuidv4();
    const state = this.encryption.hash(`${shop}:${nonce}:${Date.now()}`);

    // Store state for validation
    this.stateStore.set(state, {
      nonce,
      shop,
      timestamp: Date.now(),
    });

    // Clean up expired states
    this.cleanupExpiredStates();

    const redirectUri = `${config.APP_URL}/auth/callback`;
    const authUrl = this.shopify.generateAuthUrl(shop, state, redirectUri);

    return { authUrl, state };
  }

  // Handle OAuth callback
  async handleCallback(shop: string, code: string, state: string): Promise<{ success: boolean; shopDomain: string }> {
    // Validate state
    const storedState = this.stateStore.get(state);
    if (!storedState) {
      throw new UnauthorizedException('Invalid or expired state');
    }

    if (storedState.shop !== shop) {
      throw new UnauthorizedException('Shop mismatch');
    }

    if (Date.now() - storedState.timestamp > this.stateExpiry) {
      this.stateStore.delete(state);
      throw new UnauthorizedException('State expired');
    }

    // Clear used state
    this.stateStore.delete(state);

    // Exchange code for access token
    const accessToken = await this.shopify.exchangeCodeForToken(shop, code);

    // Encrypt and store access token
    const encryptedToken = this.encryption.encrypt(accessToken);

    // Upsert shop record
    await this.prisma.shop.upsert({
      where: { shopDomain: shop },
      update: {
        accessToken: encryptedToken,
        installedAt: new Date(),
        uninstalledAt: null,
        syncStatus: 'IDLE',
      },
      create: {
        shopDomain: shop,
        accessToken: encryptedToken,
        syncStatus: 'IDLE',
      },
    });

    // Register webhooks
    try {
      await this.shopify.registerWebhooks(shop, accessToken);
      this.logger.log(`Webhooks registered for ${shop}`);
    } catch (error) {
      this.logger.error(`Failed to register webhooks for ${shop}:`, error);
      // Continue - webhooks can be registered later
    }

    return { success: true, shopDomain: shop };
  }

  // Get shop's decrypted access token
  async getAccessToken(shopDomain: string): Promise<string | null> {
    const shop = await this.prisma.shop.findUnique({
      where: { shopDomain },
      select: { accessToken: true, uninstalledAt: true },
    });

    if (!shop || shop.uninstalledAt) {
      return null;
    }

    return this.encryption.decrypt(shop.accessToken);
  }

  // Handle app uninstall
  async handleUninstall(shopDomain: string): Promise<void> {
    await this.prisma.shop.update({
      where: { shopDomain },
      data: {
        uninstalledAt: new Date(),
      },
    });

    this.logger.log(`Shop ${shopDomain} uninstalled`);
  }

  // Check if shop is installed
  async isShopInstalled(shopDomain: string): Promise<boolean> {
    const shop = await this.prisma.shop.findUnique({
      where: { shopDomain },
      select: { id: true, uninstalledAt: true },
    });

    return shop !== null && shop.uninstalledAt === null;
  }

  private cleanupExpiredStates(): void {
    const now = Date.now();
    for (const [key, value] of this.stateStore.entries()) {
      if (now - value.timestamp > this.stateExpiry) {
        this.stateStore.delete(key);
      }
    }
  }
}
