import { Injectable, Logger, Inject } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { EmbeddingsService, EMBEDDINGS_SERVICE } from '../embeddings/embeddings.interface';
import { OverrideAction, ScopeType } from '@prisma/client';

export interface SearchResult {
  variantId: string;
  productId: string;
  handle: string;
  title: string;
  variantTitle: string | null;
  vendor: string | null;
  productType: string | null;
  price: string;
  compareAtPrice: string | null;
  currency: string;
  available: boolean;
  inventoryQuantity: number | null;
  imageUrl: string | null;
  options: Record<string, string>;
  tags: string[];
  collections: string[];
  score: number;
  lexicalScore?: number;
  semanticScore?: number;
}

export interface SearchOptions {
  shopId: string;
  query: string;
  limit?: number;
  availableOnly?: boolean;
  productType?: string;
  region?: string;
  sessionId?: string;
  variant?: 'control' | 'treatment';
}

interface ManualOverride {
  variantId: string;
  action: OverrideAction;
  weight: number;
}

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  // Simple LRU cache for query embeddings
  private readonly embeddingCache = new Map<string, { embedding: number[]; timestamp: number }>();
  private readonly cacheMaxSize = 1000;
  private readonly cacheTTL = 5 * 60 * 1000; // 5 minutes

  constructor(
    private readonly prisma: PrismaService,
    @Inject(EMBEDDINGS_SERVICE) private readonly embeddings: EmbeddingsService,
  ) {}

  async search(options: SearchOptions): Promise<SearchResult[]> {
    const {
      shopId,
      query,
      limit = 20,
      availableOnly = true,
      productType,
      variant = 'treatment',
    } = options;

    // For control variant, use only lexical search
    if (variant === 'control') {
      return this.lexicalSearch(shopId, query, limit, availableOnly, productType);
    }

    // Treatment variant uses hybrid search
    const [lexicalResults, semanticResults] = await Promise.all([
      this.getLexicalCandidates(shopId, query, limit * 2, availableOnly, productType),
      this.getSemanticCandidates(shopId, query, limit * 2, availableOnly, productType),
    ]);

    // Merge and deduplicate
    const resultMap = new Map<string, SearchResult>();

    for (const result of lexicalResults) {
      resultMap.set(result.variantId, result);
    }

    for (const result of semanticResults) {
      const existing = resultMap.get(result.variantId);
      if (existing) {
        // Combine scores
        existing.semanticScore = result.semanticScore;
      } else {
        resultMap.set(result.variantId, result);
      }
    }

    // Get overrides
    const overrides = await this.getOverrides(shopId, query, productType);

    // Apply reranking
    const reranked = this.rerank(Array.from(resultMap.values()), overrides);

    return reranked.slice(0, limit);
  }

  private async lexicalSearch(
    shopId: string,
    query: string,
    limit: number,
    availableOnly: boolean,
    productType?: string,
  ): Promise<SearchResult[]> {
    const results = await this.getLexicalCandidates(shopId, query, limit, availableOnly, productType);
    return results;
  }

  private async getLexicalCandidates(
    shopId: string,
    query: string,
    limit: number,
    availableOnly: boolean,
    productType?: string,
  ): Promise<SearchResult[]> {
    // Build websearch-style query
    const tsQuery = query
      .split(/\s+/)
      .filter(term => term.length > 0)
      .map(term => term.replace(/[^\w]/g, ''))
      .filter(term => term.length > 0)
      .join(' & ');

    if (!tsQuery) {
      return [];
    }

    const results = await this.prisma.$queryRaw<Array<{
      id: string;
      variant_id: string;
      product_id: string;
      handle: string;
      title: string;
      variant_title: string | null;
      vendor: string | null;
      product_type: string | null;
      price: number;
      compare_at_price: number | null;
      currency: string;
      available: boolean;
      inventory_quantity: number | null;
      image_url: string | null;
      options: Record<string, string>;
      tags: string[];
      collections: string[];
      rank: number;
    }>>`
      SELECT
        pv.id,
        pv.variant_id,
        pv.product_id,
        pv.handle,
        pv.title,
        pv.variant_title,
        pv.vendor,
        pv.product_type,
        pv.price::float,
        pv.compare_at_price::float,
        pv.currency,
        pv.available,
        pv.inventory_quantity,
        pv.image_url,
        pv.options,
        pv.tags,
        pv.collections,
        ts_rank_cd(
          to_tsvector('english', pv.canonical_text || ' ' || pv.title || ' ' || COALESCE(pv.vendor, '') || ' ' || COALESCE(pv.product_type, '') || ' ' || COALESCE(pv.variant_title, '')),
          websearch_to_tsquery('english', ${query})
        ) as rank
      FROM product_variants pv
      WHERE pv.shop_id = ${shopId}
        AND (${!availableOnly} OR pv.available = true)
        AND (${!productType} OR pv.product_type = ${productType})
        AND to_tsvector('english', pv.canonical_text || ' ' || pv.title || ' ' || COALESCE(pv.vendor, '') || ' ' || COALESCE(pv.product_type, '') || ' ' || COALESCE(pv.variant_title, ''))
            @@ websearch_to_tsquery('english', ${query})
      ORDER BY rank DESC
      LIMIT ${limit}
    `;

    return results.map(r => ({
      variantId: r.variant_id,
      productId: r.product_id,
      handle: r.handle,
      title: r.title,
      variantTitle: r.variant_title,
      vendor: r.vendor,
      productType: r.product_type,
      price: r.price.toString(),
      compareAtPrice: r.compare_at_price?.toString() || null,
      currency: r.currency,
      available: r.available,
      inventoryQuantity: r.inventory_quantity,
      imageUrl: r.image_url,
      options: r.options || {},
      tags: r.tags || [],
      collections: r.collections || [],
      score: r.rank,
      lexicalScore: r.rank,
    }));
  }

  private async getSemanticCandidates(
    shopId: string,
    query: string,
    limit: number,
    availableOnly: boolean,
    productType?: string,
  ): Promise<SearchResult[]> {
    // Get query embedding with caching
    const queryEmbedding = await this.getQueryEmbedding(query);
    const embeddingStr = `[${queryEmbedding.join(',')}]`;

    const results = await this.prisma.$queryRaw<Array<{
      id: string;
      variant_id: string;
      product_id: string;
      handle: string;
      title: string;
      variant_title: string | null;
      vendor: string | null;
      product_type: string | null;
      price: number;
      compare_at_price: number | null;
      currency: string;
      available: boolean;
      inventory_quantity: number | null;
      image_url: string | null;
      options: Record<string, string>;
      tags: string[];
      collections: string[];
      distance: number;
    }>>`
      SELECT
        pv.id,
        pv.variant_id,
        pv.product_id,
        pv.handle,
        pv.title,
        pv.variant_title,
        pv.vendor,
        pv.product_type,
        pv.price::float,
        pv.compare_at_price::float,
        pv.currency,
        pv.available,
        pv.inventory_quantity,
        pv.image_url,
        pv.options,
        pv.tags,
        pv.collections,
        pv.embedding <=> ${embeddingStr}::vector as distance
      FROM product_variants pv
      WHERE pv.shop_id = ${shopId}
        AND pv.embedding IS NOT NULL
        AND (${!availableOnly} OR pv.available = true)
        AND (${!productType} OR pv.product_type = ${productType})
      ORDER BY distance ASC
      LIMIT ${limit}
    `;

    return results.map(r => ({
      variantId: r.variant_id,
      productId: r.product_id,
      handle: r.handle,
      title: r.title,
      variantTitle: r.variant_title,
      vendor: r.vendor,
      productType: r.product_type,
      price: r.price.toString(),
      compareAtPrice: r.compare_at_price?.toString() || null,
      currency: r.currency,
      available: r.available,
      inventoryQuantity: r.inventory_quantity,
      imageUrl: r.image_url,
      options: r.options || {},
      tags: r.tags || [],
      collections: r.collections || [],
      score: 1 - r.distance, // Convert distance to similarity
      semanticScore: 1 - r.distance,
    }));
  }

  private async getQueryEmbedding(query: string): Promise<number[]> {
    const cacheKey = query.toLowerCase().trim();
    const cached = this.embeddingCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.embedding;
    }

    const embedding = await this.embeddings.generateEmbedding(query);

    // Add to cache
    if (this.embeddingCache.size >= this.cacheMaxSize) {
      // Remove oldest entry
      const oldestKey = this.embeddingCache.keys().next().value;
      if (oldestKey) {
        this.embeddingCache.delete(oldestKey);
      }
    }
    this.embeddingCache.set(cacheKey, { embedding, timestamp: Date.now() });

    return embedding;
  }

  private async getOverrides(
    shopId: string,
    query: string,
    productType?: string,
  ): Promise<Map<string, ManualOverride>> {
    const overrides = await this.prisma.manualOverride.findMany({
      where: {
        shopId,
        OR: [
          { scopeType: ScopeType.GLOBAL },
          { scopeType: ScopeType.QUERY, scopeValue: query.toLowerCase() },
          productType
            ? { scopeType: ScopeType.CATEGORY, scopeValue: productType }
            : { scopeType: ScopeType.CATEGORY, scopeValue: undefined },
        ],
      },
    });

    const overrideMap = new Map<string, ManualOverride>();
    for (const override of overrides) {
      // More specific scopes override less specific ones
      const existing = overrideMap.get(override.variantId);
      if (!existing || this.getScopePriority(override.scopeType) > this.getScopePriority(existing.action as unknown as ScopeType)) {
        overrideMap.set(override.variantId, {
          variantId: override.variantId,
          action: override.action,
          weight: override.weight,
        });
      }
    }

    return overrideMap;
  }

  private getScopePriority(scope: ScopeType): number {
    switch (scope) {
      case ScopeType.QUERY:
        return 3;
      case ScopeType.CATEGORY:
        return 2;
      case ScopeType.GLOBAL:
        return 1;
      default:
        return 0;
    }
  }

  private rerank(results: SearchResult[], overrides: Map<string, ManualOverride>): SearchResult[] {
    const pinned: SearchResult[] = [];
    const excluded = new Set<string>();
    const regular: SearchResult[] = [];

    // First pass: identify pinned and excluded
    for (const result of results) {
      const override = overrides.get(result.variantId);
      if (override) {
        if (override.action === OverrideAction.PIN) {
          pinned.push(result);
          continue;
        }
        if (override.action === OverrideAction.EXCLUDE) {
          excluded.add(result.variantId);
          continue;
        }
      }
      regular.push(result);
    }

    // Score regular results
    const scored = regular.map(result => {
      const override = overrides.get(result.variantId);
      let score = this.calculateBaseScore(result);

      // Apply inventory boost
      if (result.available && result.inventoryQuantity && result.inventoryQuantity > 0) {
        score *= 1.1; // 10% boost for in-stock items
      }

      // Apply override weight
      if (override) {
        if (override.action === OverrideAction.BOOST) {
          score *= override.weight;
        } else if (override.action === OverrideAction.DEMOTE) {
          score *= override.weight;
        }
      }

      return { ...result, score };
    });

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);

    // Combine: pinned first, then scored
    return [...pinned, ...scored];
  }

  private calculateBaseScore(result: SearchResult): number {
    const lexical = result.lexicalScore || 0;
    const semantic = result.semanticScore || 0;

    // Weighted combination
    // If both scores exist, combine them
    if (lexical > 0 && semantic > 0) {
      return 0.4 * lexical + 0.6 * semantic;
    }
    // If only one exists, use it
    return Math.max(lexical, semantic);
  }
}
