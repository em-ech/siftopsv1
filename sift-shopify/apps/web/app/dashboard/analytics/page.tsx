'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { api, AnalyticsSummary, TopQuery, DailyMetrics } from '@/lib/api';
import { formatNumber, formatPercent } from '@/lib/utils';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';
import { Loader2, TrendingUp, Search, MousePointer } from 'lucide-react';

export default function AnalyticsPage() {
  const searchParams = useSearchParams();
  const shop = searchParams.get('shop') || 'demo-store.myshopify.com';

  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [topQueries, setTopQueries] = useState<TopQuery[]>([]);
  const [dailyMetrics, setDailyMetrics] = useState<DailyMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [summaryData, queriesData, metricsData] = await Promise.all([
          api.getAnalyticsSummary(shop, 7),
          api.getTopQueries(shop, 10),
          api.getDailyMetrics(shop, 7),
        ]);
        setSummary(summaryData);
        setTopQueries(queriesData);
        setDailyMetrics(metricsData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load analytics');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [shop]);

  // Process daily metrics for chart
  const chartData = dailyMetrics.reduce((acc: any[], metric) => {
    const existing = acc.find(d => d.date === metric.date);
    if (existing) {
      if (metric.variant === 'control') {
        existing.controlSearches = metric.searches;
        existing.controlClicks = metric.clicks;
      } else {
        existing.treatmentSearches = metric.searches;
        existing.treatmentClicks = metric.clicks;
      }
    } else {
      acc.push({
        date: metric.date,
        controlSearches: metric.variant === 'control' ? metric.searches : 0,
        controlClicks: metric.variant === 'control' ? metric.clicks : 0,
        treatmentSearches: metric.variant === 'treatment' ? metric.searches : 0,
        treatmentClicks: metric.variant === 'treatment' ? metric.clicks : 0,
      });
    }
    return acc;
  }, []).sort((a, b) => a.date.localeCompare(b.date));

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
          <CardContent className="pt-6">
            <p className="text-destructive">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Analytics</h1>
        <p className="text-muted-foreground">
          Search performance metrics and A/B test results
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Searches</CardTitle>
            <Search className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary ? formatNumber(summary.totalSearches) : '0'}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Clicks</CardTitle>
            <MousePointer className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary ? formatNumber(summary.totalClicks) : '0'}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">CTR</CardTitle>
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary ? formatPercent(summary.clickThroughRate) : '0%'}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary ? formatPercent(summary.conversionRate) : '0%'}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2 mb-8">
        <Card>
          <CardHeader>
            <CardTitle>Daily Searches</CardTitle>
            <CardDescription>
              Control vs Treatment search volume over time
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => value.slice(5)}
                  />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="controlSearches"
                    stroke="#94a3b8"
                    name="Control"
                    strokeWidth={2}
                  />
                  <Line
                    type="monotone"
                    dataKey="treatmentSearches"
                    stroke="#3b82f6"
                    name="Treatment"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Daily Clicks</CardTitle>
            <CardDescription>
              Click volume by variant over time
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => value.slice(5)}
                  />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Bar
                    dataKey="controlClicks"
                    fill="#94a3b8"
                    name="Control"
                  />
                  <Bar
                    dataKey="treatmentClicks"
                    fill="#3b82f6"
                    name="Treatment"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Queries */}
      <Card>
        <CardHeader>
          <CardTitle>Top Queries</CardTitle>
          <CardDescription>
            Most popular search terms in the last 7 days
          </CardDescription>
        </CardHeader>
        <CardContent>
          {topQueries.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No search data available
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-medium">Query</th>
                    <th className="text-right py-3 px-4 font-medium">Searches</th>
                    <th className="text-right py-3 px-4 font-medium">Clicks</th>
                    <th className="text-right py-3 px-4 font-medium">CTR</th>
                    <th className="text-right py-3 px-4 font-medium">Purchases</th>
                  </tr>
                </thead>
                <tbody>
                  {topQueries.map((query, index) => (
                    <tr key={index} className="border-b last:border-0">
                      <td className="py-3 px-4">
                        <Badge variant="outline">{query.query}</Badge>
                      </td>
                      <td className="text-right py-3 px-4">
                        {formatNumber(query.searchCount)}
                      </td>
                      <td className="text-right py-3 px-4">
                        {formatNumber(query.clickCount)}
                      </td>
                      <td className="text-right py-3 px-4">
                        {formatPercent(query.ctr)}
                      </td>
                      <td className="text-right py-3 px-4">
                        {formatNumber(query.purchaseCount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
