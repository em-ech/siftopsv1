'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { api, SearchResult, SearchResponse } from '@/lib/api';
import { formatCurrency, cn } from '@/lib/utils';
import {
  Search,
  Loader2,
  Package,
  MousePointer,
  ShoppingCart,
  ExternalLink,
} from 'lucide-react';

export default function SearchConsolePage() {
  const searchParams = useSearchParams();
  const shop = searchParams.get('shop') || 'demo-store.myshopify.com';

  const [query, setQuery] = useState('');
  const [variant, setVariant] = useState<'control' | 'treatment'>('treatment');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError(null);
    try {
      const response = await api.search(shop, query.trim(), variant, true);
      setResults(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  const handleClick = async (result: SearchResult) => {
    if (results?.searchEventId) {
      try {
        await api.recordClick(results.searchEventId, result.variantId);
      } catch (err) {
        console.error('Failed to record click:', err);
      }
    }
  };

  const handlePurchase = async (result: SearchResult) => {
    if (results?.searchEventId) {
      try {
        const revenue = parseFloat(result.price);
        await api.recordPurchase(results.searchEventId, result.variantId, revenue);
      } catch (err) {
        console.error('Failed to record purchase:', err);
      }
    }
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Search Console</h1>
        <p className="text-muted-foreground">
          Test search queries and simulate user interactions
        </p>
      </div>

      {/* Search Form */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Test Search</CardTitle>
          <CardDescription>
            Enter a search query and select a variant to test
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <Label htmlFor="query" className="sr-only">
                Search Query
              </Label>
              <Input
                id="query"
                placeholder="Search products..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <div className="w-full sm:w-48">
              <Label htmlFor="variant" className="sr-only">
                Variant
              </Label>
              <Select
                value={variant}
                onValueChange={(v) => setVariant(v as 'control' | 'treatment')}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select variant" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="control">Control (Lexical)</SelectItem>
                  <SelectItem value="treatment">Treatment (Hybrid)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" disabled={loading || !query.trim()}>
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
              <span className="ml-2">Search</span>
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Error */}
      {error && (
        <Card className="mb-8 border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {results && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <h2 className="text-xl font-semibold">Results</h2>
              <Badge variant={variant === 'treatment' ? 'default' : 'secondary'}>
                {variant === 'treatment' ? 'Hybrid Search' : 'Lexical Only'}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {results.totalResults} results for &quot;{results.query}&quot;
            </p>
          </div>

          {results.results.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center">
                <Package className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No products found</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {results.results.map((result) => (
                <Card key={result.variantId} className="overflow-hidden">
                  <div className="aspect-square bg-slate-100 flex items-center justify-center">
                    {result.imageUrl ? (
                      <img
                        src={result.imageUrl}
                        alt={result.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Package className="w-16 h-16 text-slate-300" />
                    )}
                  </div>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="font-medium line-clamp-1">{result.title}</h3>
                        {result.variantTitle && (
                          <p className="text-sm text-muted-foreground">
                            {result.variantTitle}
                          </p>
                        )}
                      </div>
                      <Badge
                        variant={result.available ? 'success' : 'destructive'}
                        className="flex-shrink-0"
                      >
                        {result.available ? 'In Stock' : 'Out of Stock'}
                      </Badge>
                    </div>

                    {result.vendor && (
                      <p className="text-sm text-muted-foreground mb-2">
                        by {result.vendor}
                      </p>
                    )}

                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-lg font-bold">
                        {formatCurrency(result.price, result.currency)}
                      </span>
                      {result.compareAtPrice && (
                        <span className="text-sm text-muted-foreground line-through">
                          {formatCurrency(result.compareAtPrice, result.currency)}
                        </span>
                      )}
                    </div>

                    {/* Score */}
                    <div className="flex items-center gap-2 mb-3 text-xs text-muted-foreground">
                      <span>Score: {result.score.toFixed(3)}</span>
                      {result.productType && (
                        <>
                          <span>•</span>
                          <span>{result.productType}</span>
                        </>
                      )}
                    </div>

                    {/* Options */}
                    {Object.keys(result.options || {}).length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {Object.entries(result.options).map(([key, value]) => (
                          <Badge key={key} variant="outline" className="text-xs">
                            {key}: {value}
                          </Badge>
                        ))}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() => handleClick(result)}
                      >
                        <MousePointer className="w-3 h-3 mr-1" />
                        Click
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() => handlePurchase(result)}
                      >
                        <ShoppingCart className="w-3 h-3 mr-1" />
                        Purchase
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
