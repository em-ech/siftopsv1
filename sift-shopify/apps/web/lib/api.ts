const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface FetchOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
}

async function fetchAPI<T>(endpoint: string, options: FetchOptions = {}): Promise<T> {
  const { params, ...fetchOptions } = options;

  let url = `${API_URL}${endpoint}`;

  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        searchParams.append(key, String(value));
      }
    });
    url += `?${searchParams.toString()}`;
  }

  const response = await fetch(url, {
    ...fetchOptions,
    headers: {
      'Content-Type': 'application/json',
      ...fetchOptions.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  return response.json();
}

// Shop types
export interface Shop {
  id: string;
  shopDomain: string;
  installedAt: string;
  uninstalledAt: string | null;
  syncStatus: string;
  lastSyncAt: string | null;
  variantCount: number;
}

// Search types
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
}

export interface SearchResponse {
  results: SearchResult[];
  query: string;
  totalResults: number;
  variant: 'control' | 'treatment';
  searchEventId?: string;
}

// Analytics types
export interface AnalyticsSummary {
  totalSearches: number;
  totalClicks: number;
  totalPurchases: number;
  totalRevenue: number;
  clickThroughRate: number;
  conversionRate: number;
  averageOrderValue: number;
  controlSearches: number;
  treatmentSearches: number;
  controlClicks: number;
  treatmentClicks: number;
  controlPurchases: number;
  treatmentPurchases: number;
}

export interface TopQuery {
  query: string;
  searchCount: number;
  clickCount: number;
  purchaseCount: number;
  ctr: number;
}

export interface DailyMetrics {
  date: string;
  searches: number;
  clicks: number;
  purchases: number;
  revenue: number;
  variant: 'control' | 'treatment';
}

// Override types
export interface Override {
  id: string;
  scopeType: string;
  scopeValue: string | null;
  variantId: string;
  action: string;
  weight: number;
  createdAt: string;
  updatedAt: string;
}

// Variant types
export interface ProductVariant {
  id: string;
  variantId: string;
  productId: string;
  handle: string;
  title: string;
  variantTitle: string | null;
  vendor: string | null;
  productType: string | null;
  price: number;
  available: boolean;
  inventoryQuantity: number | null;
  imageUrl: string | null;
}

// Status types
export interface ShopStatus {
  status: string;
  lastSyncAt: string | null;
  error: string | null;
  variantCount: number;
  lastWebhook: {
    topic: string;
    receivedAt: string;
    processed: boolean;
  } | null;
}

// API functions
export const api = {
  // Auth
  checkInstallStatus: (shop: string) =>
    fetchAPI<{ installed: boolean }>('/auth/status', { params: { shop } }),

  // Admin
  listShops: () =>
    fetchAPI<Shop[]>('/admin/shops'),

  getShopStatus: (shop: string) =>
    fetchAPI<ShopStatus>('/admin/status', { params: { shop } }),

  startBackfill: (shop: string) =>
    fetchAPI<{ success: boolean; operationId: string }>('/admin/backfill', {
      method: 'POST',
      params: { shop },
    }),

  pollBackfill: (shop: string) =>
    fetchAPI<{ status: string }>('/admin/poll-backfill', { params: { shop } }),

  listVariants: (shop: string, limit?: number, offset?: number, search?: string) =>
    fetchAPI<{ variants: ProductVariant[]; total: number; limit: number; offset: number }>(
      '/admin/variants',
      { params: { shop, limit, offset, search } }
    ),

  // Search
  search: (shop: string, query: string, variant: 'control' | 'treatment' = 'treatment', recordEvent = true) =>
    fetchAPI<SearchResponse>('/search', {
      params: {
        shop,
        q: query,
        variant,
        record_event: recordEvent ? 'true' : 'false',
      },
    }),

  // Analytics
  getAnalyticsSummary: (shop: string, days?: number) =>
    fetchAPI<AnalyticsSummary>('/analytics/summary', { params: { shop, days } }),

  getTopQueries: (shop: string, limit?: number) =>
    fetchAPI<TopQuery[]>('/analytics/top-queries', { params: { shop, limit } }),

  getDailyMetrics: (shop: string, days?: number) =>
    fetchAPI<DailyMetrics[]>('/analytics/daily', { params: { shop, days } }),

  recordClick: (searchEventId: string, variantId: string) =>
    fetchAPI<{ success: boolean }>('/analytics/click', {
      method: 'POST',
      body: JSON.stringify({ searchEventId, variantId }),
    }),

  recordPurchase: (searchEventId: string, variantId: string, revenue: number) =>
    fetchAPI<{ success: boolean }>('/analytics/purchase', {
      method: 'POST',
      body: JSON.stringify({ searchEventId, variantId, revenue }),
    }),

  // Overrides
  getOverrides: (shop: string) =>
    fetchAPI<Override[]>('/admin/overrides', { params: { shop } }),

  createOverride: (data: {
    shopDomain: string;
    scopeType: string;
    scopeValue?: string;
    variantId: string;
    action: string;
    weight?: number;
  }) =>
    fetchAPI<Override>('/admin/overrides', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateOverride: (id: string, data: Partial<{
    scopeType: string;
    scopeValue?: string;
    variantId: string;
    action: string;
    weight?: number;
  }>) =>
    fetchAPI<Override>(`/admin/overrides/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteOverride: (id: string) =>
    fetchAPI<{ success: boolean }>(`/admin/overrides/${id}`, {
      method: 'DELETE',
    }),
};
