import {
  Controller,
  Get,
  Query,
  Res,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { config } from '../../env';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly authService: AuthService) {}

  @Get('install')
  async install(
    @Query('shop') shop: string,
    @Res() res: Response,
  ): Promise<void> {
    if (!shop) {
      throw new BadRequestException('Shop parameter is required');
    }

    // Normalize shop domain
    const normalizedShop = shop.includes('.myshopify.com')
      ? shop
      : `${shop}.myshopify.com`;

    this.logger.log(`Starting OAuth for shop: ${normalizedShop}`);

    try {
      const { authUrl } = this.authService.initiateOAuth(normalizedShop);
      res.redirect(authUrl);
    } catch (error) {
      this.logger.error(`OAuth initiation failed for ${normalizedShop}:`, error);
      throw error;
    }
  }

  @Get('callback')
  async callback(
    @Query('shop') shop: string,
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('hmac') hmac: string,
    @Res() res: Response,
  ): Promise<void> {
    if (!shop || !code || !state) {
      throw new BadRequestException('Missing required OAuth parameters');
    }

    this.logger.log(`OAuth callback for shop: ${shop}`);

    try {
      const result = await this.authService.handleCallback(shop, code, state);

      // Redirect to frontend dashboard
      const dashboardUrl = `${config.FRONTEND_URL}/dashboard?shop=${encodeURIComponent(result.shopDomain)}&installed=true`;
      res.redirect(dashboardUrl);
    } catch (error) {
      this.logger.error(`OAuth callback failed for ${shop}:`, error);
      // Redirect to error page
      const errorUrl = `${config.FRONTEND_URL}/install?error=oauth_failed&shop=${encodeURIComponent(shop)}`;
      res.redirect(errorUrl);
    }
  }

  @Get('status')
  async status(@Query('shop') shop: string): Promise<{ installed: boolean }> {
    if (!shop) {
      throw new BadRequestException('Shop parameter is required');
    }

    const installed = await this.authService.isShopInstalled(shop);
    return { installed };
  }
}
