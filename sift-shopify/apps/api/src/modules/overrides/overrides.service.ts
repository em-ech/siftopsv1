import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { OverrideAction, ScopeType } from '@prisma/client';

export interface CreateOverrideParams {
  shopDomain: string;
  scopeType: 'query' | 'category' | 'global';
  scopeValue?: string;
  variantId: string;
  action: 'pin' | 'boost' | 'demote' | 'exclude';
  weight?: number;
}

export interface OverrideRecord {
  id: string;
  scopeType: string;
  scopeValue: string | null;
  variantId: string;
  action: string;
  weight: number;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class OverridesService {
  private readonly logger = new Logger(OverridesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createOverride(params: CreateOverrideParams): Promise<OverrideRecord> {
    const shop = await this.prisma.shop.findUnique({
      where: { shopDomain: params.shopDomain },
    });

    if (!shop) {
      throw new NotFoundException(`Shop not found: ${params.shopDomain}`);
    }

    const scopeType = this.mapScopeType(params.scopeType);
    const action = this.mapAction(params.action);
    const weight = params.weight ?? this.getDefaultWeight(params.action);

    const scopeValue = params.scopeValue || null;

    // For composite unique with nullable field, we need to handle it carefully
    const existing = await this.prisma.manualOverride.findFirst({
      where: {
        shopId: shop.id,
        scopeType,
        scopeValue,
        variantId: params.variantId,
      },
    });

    let override;
    if (existing) {
      override = await this.prisma.manualOverride.update({
        where: { id: existing.id },
        data: { action, weight },
      });
    } else {
      override = await this.prisma.manualOverride.create({
        data: {
          shopId: shop.id,
          scopeType,
          scopeValue,
          variantId: params.variantId,
          action,
          weight,
        },
      });
    }

    return this.mapOverrideToRecord(override);
  }

  async getOverrides(shopDomain: string): Promise<OverrideRecord[]> {
    const shop = await this.prisma.shop.findUnique({
      where: { shopDomain },
    });

    if (!shop) {
      throw new NotFoundException(`Shop not found: ${shopDomain}`);
    }

    const overrides = await this.prisma.manualOverride.findMany({
      where: { shopId: shop.id },
      orderBy: { createdAt: 'desc' },
    });

    return overrides.map(this.mapOverrideToRecord);
  }

  async deleteOverride(id: string): Promise<void> {
    await this.prisma.manualOverride.delete({
      where: { id },
    });
  }

  async updateOverride(id: string, params: Partial<CreateOverrideParams>): Promise<OverrideRecord> {
    const updateData: any = {};

    if (params.scopeType) {
      updateData.scopeType = this.mapScopeType(params.scopeType);
    }
    if (params.scopeValue !== undefined) {
      updateData.scopeValue = params.scopeValue || null;
    }
    if (params.variantId) {
      updateData.variantId = params.variantId;
    }
    if (params.action) {
      updateData.action = this.mapAction(params.action);
    }
    if (params.weight !== undefined) {
      updateData.weight = params.weight;
    }

    const override = await this.prisma.manualOverride.update({
      where: { id },
      data: updateData,
    });

    return this.mapOverrideToRecord(override);
  }

  private mapScopeType(type: string): ScopeType {
    switch (type.toLowerCase()) {
      case 'query':
        return ScopeType.QUERY;
      case 'category':
        return ScopeType.CATEGORY;
      case 'global':
        return ScopeType.GLOBAL;
      default:
        return ScopeType.GLOBAL;
    }
  }

  private mapAction(action: string): OverrideAction {
    switch (action.toLowerCase()) {
      case 'pin':
        return OverrideAction.PIN;
      case 'boost':
        return OverrideAction.BOOST;
      case 'demote':
        return OverrideAction.DEMOTE;
      case 'exclude':
        return OverrideAction.EXCLUDE;
      default:
        return OverrideAction.BOOST;
    }
  }

  private getDefaultWeight(action: string): number {
    switch (action.toLowerCase()) {
      case 'pin':
        return 1.0;
      case 'boost':
        return 1.5;
      case 'demote':
        return 0.5;
      case 'exclude':
        return 0;
      default:
        return 1.0;
    }
  }

  private mapOverrideToRecord(override: any): OverrideRecord {
    return {
      id: override.id,
      scopeType: override.scopeType.toLowerCase(),
      scopeValue: override.scopeValue,
      variantId: override.variantId,
      action: override.action.toLowerCase(),
      weight: override.weight,
      createdAt: override.createdAt,
      updatedAt: override.updatedAt,
    };
  }
}
