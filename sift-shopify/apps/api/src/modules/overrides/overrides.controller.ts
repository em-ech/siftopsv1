import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Query,
  Body,
  Param,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { OverridesService, CreateOverrideParams } from './overrides.service';

@Controller('admin/overrides')
export class OverridesController {
  private readonly logger = new Logger(OverridesController.name);

  constructor(private readonly overridesService: OverridesService) {}

  @Get()
  async getOverrides(@Query('shop') shopDomain: string) {
    if (!shopDomain) {
      throw new BadRequestException('shop parameter is required');
    }

    return this.overridesService.getOverrides(shopDomain);
  }

  @Post()
  async createOverride(@Body() body: CreateOverrideParams) {
    if (!body.shopDomain) {
      throw new BadRequestException('shopDomain is required');
    }
    if (!body.variantId) {
      throw new BadRequestException('variantId is required');
    }
    if (!body.action) {
      throw new BadRequestException('action is required');
    }
    if (!body.scopeType) {
      throw new BadRequestException('scopeType is required');
    }

    return this.overridesService.createOverride(body);
  }

  @Put(':id')
  async updateOverride(
    @Param('id') id: string,
    @Body() body: Partial<CreateOverrideParams>,
  ) {
    return this.overridesService.updateOverride(id, body);
  }

  @Delete(':id')
  async deleteOverride(@Param('id') id: string) {
    await this.overridesService.deleteOverride(id);
    return { success: true };
  }
}
