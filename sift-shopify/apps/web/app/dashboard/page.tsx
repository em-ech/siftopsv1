'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { api, ShopStatus, AnalyticsSummary } from '@/lib/api';
import { formatNumber, formatPercent, formatCurrency, formatDate } from '@/lib/utils';
import {
  Package,
  RefreshCw,
  Clock,
  AlertCircle,
  CheckCircle2,
  Search,
  MousePointer,
  ShoppingCart,
  Loader2,
} from 'lucide-react';

export default function DashboardPage() {
  const searchParams = useSearchParams();
  const shop = searchParams.get('shop') || 'demo-store.myshopify.com';

  const [status, setStatus] = useState<ShopStatus | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [backfillLoading, setBackfillLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [statusData, analyticsData] = await Promise.all([
        api.getShopStatus(shop),
        api.getAnalyticsSummary(shop),
      ]);
      setStatus(statusData);
      setAnalytics(analyticsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // Poll status while backfill is running
    const interval = setInterval(() => {
      if (status?.status === 'BACKFILL_RUNNING') {
        api.getShopStatus(shop).then(setStatus).catch(console.error);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [shop, status?.status]);

  const handleStartBackfill = async () => {
    setBackfillLoading(true);
    try {
      await api.startBackfill(shop);
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start backfill');
    } finally {
      setBackfillLoading(false);
    }
  };

  const getSyncStatusBadge = (syncStatus: string) => {
    switch (syncStatus) {
      case 'IDLE':
        return <Badge variant="secondary">Idle</Badge>;
      case 'BACKFILL_PENDING':
        return <Badge variant="warning">Pending</Badge>;
      case 'BACKFILL_RUNNING':
        return <Badge variant="warning">Syncing</Badge>;
      case 'BACKFILL_COMPLETE':
        return <Badge variant="success">Synced</Badge>;
      case 'ERROR':
        return <Badge variant="destructive">Error</Badge>;
      default:
        return <Badge variant="outline">{syncStatus}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <Card className="border-destructive">
          <CardHeader>
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="w-5 h-5" />
              <CardTitle>Error</CardTitle>
            </div>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={fetchData}>Retry</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
        <p className="text-muted-foreground">
          Overview of your shop&apos;s search performance
        </p>
      </div>

      {/* Status Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Sync Status</CardTitle>
            <RefreshCw className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {status && getSyncStatusBadge(status.status)}
            </div>
            {status?.lastSyncAt && (
              <p className="text-xs text-muted-foreground mt-2">
                Last sync: {formatDate(status.lastSyncAt)}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Catalog Size</CardTitle>
            <Package className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {status ? formatNumber(status.variantCount) : '0'}
            </div>
            <p className="text-xs text-muted-foreground">product variants indexed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Last Webhook</CardTitle>
            <Clock className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {status?.lastWebhook ? (
              <>
                <div className="flex items-center gap-2">
                  {status.lastWebhook.processed ? (
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                  ) : (
                    <Clock className="w-4 h-4 text-yellow-500" />
                  )}
                  <span className="text-sm font-medium">
                    {status.lastWebhook.topic.replace('/', ' ')}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatDate(status.lastWebhook.receivedAt)}
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No webhooks received</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Backfill</CardTitle>
            <RefreshCw className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <Button
              size="sm"
              onClick={handleStartBackfill}
              disabled={backfillLoading || status?.status === 'BACKFILL_RUNNING'}
            >
              {backfillLoading || status?.status === 'BACKFILL_RUNNING' ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Running...
                </>
              ) : (
                'Start Backfill'
              )}
            </Button>
            {status?.error && (
              <p className="text-xs text-destructive mt-2">{status.error}</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Analytics Summary */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Last 7 Days</h2>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Searches</CardTitle>
              <Search className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {analytics ? formatNumber(analytics.totalSearches) : '0'}
              </div>
              <p className="text-xs text-muted-foreground">
                {analytics && analytics.controlSearches} control / {analytics && analytics.treatmentSearches} treatment
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Click-through Rate</CardTitle>
              <MousePointer className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {analytics ? formatPercent(analytics.clickThroughRate) : '0%'}
              </div>
              <p className="text-xs text-muted-foreground">
                {analytics && formatNumber(analytics.totalClicks)} total clicks
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
              <ShoppingCart className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {analytics ? formatPercent(analytics.conversionRate) : '0%'}
              </div>
              <p className="text-xs text-muted-foreground">
                {analytics && formatNumber(analytics.totalPurchases)} purchases
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Revenue</CardTitle>
              <ShoppingCart className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {analytics ? formatCurrency(analytics.totalRevenue) : '$0'}
              </div>
              <p className="text-xs text-muted-foreground">
                AOV: {analytics ? formatCurrency(analytics.averageOrderValue) : '$0'}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* A/B Test Comparison */}
      <Card>
        <CardHeader>
          <CardTitle>A/B Test Results</CardTitle>
          <CardDescription>
            Compare control (lexical only) vs treatment (hybrid search)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <h3 className="font-medium mb-4 flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-slate-400" />
                Control (Lexical)
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Searches</span>
                  <span className="font-medium">
                    {analytics ? formatNumber(analytics.controlSearches) : '0'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Clicks</span>
                  <span className="font-medium">
                    {analytics ? formatNumber(analytics.controlClicks) : '0'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">CTR</span>
                  <span className="font-medium">
                    {analytics && analytics.controlSearches > 0
                      ? formatPercent(analytics.controlClicks / analytics.controlSearches)
                      : '0%'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Purchases</span>
                  <span className="font-medium">
                    {analytics ? formatNumber(analytics.controlPurchases) : '0'}
                  </span>
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-medium mb-4 flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-primary" />
                Treatment (Hybrid)
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Searches</span>
                  <span className="font-medium">
                    {analytics ? formatNumber(analytics.treatmentSearches) : '0'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Clicks</span>
                  <span className="font-medium">
                    {analytics ? formatNumber(analytics.treatmentClicks) : '0'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">CTR</span>
                  <span className="font-medium">
                    {analytics && analytics.treatmentSearches > 0
                      ? formatPercent(analytics.treatmentClicks / analytics.treatmentSearches)
                      : '0%'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Purchases</span>
                  <span className="font-medium">
                    {analytics ? formatNumber(analytics.treatmentPurchases) : '0'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
