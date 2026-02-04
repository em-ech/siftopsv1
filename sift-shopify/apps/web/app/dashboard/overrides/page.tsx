'use client';

import { useState, useEffect } from 'react';
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
import { api, Override, ProductVariant } from '@/lib/api';
import {
  Loader2,
  Plus,
  Trash2,
  Pin,
  TrendingUp,
  TrendingDown,
  Ban,
  X,
} from 'lucide-react';

const actionIcons = {
  pin: Pin,
  boost: TrendingUp,
  demote: TrendingDown,
  exclude: Ban,
};

const actionColors = {
  pin: 'bg-blue-100 text-blue-800',
  boost: 'bg-green-100 text-green-800',
  demote: 'bg-yellow-100 text-yellow-800',
  exclude: 'bg-red-100 text-red-800',
};

export default function OverridesPage() {
  const searchParams = useSearchParams();
  const shop = searchParams.get('shop') || 'demo-store.myshopify.com';

  const [overrides, setOverrides] = useState<Override[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [scopeType, setScopeType] = useState<string>('global');
  const [scopeValue, setScopeValue] = useState('');
  const [variantId, setVariantId] = useState('');
  const [action, setAction] = useState('boost');
  const [weight, setWeight] = useState('1.5');
  const [variantSearch, setVariantSearch] = useState('');

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [overridesData, variantsData] = await Promise.all([
        api.getOverrides(shop),
        api.listVariants(shop, 50),
      ]);
      setOverrides(overridesData);
      setVariants(variantsData.variants);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [shop]);

  // Search variants when search term changes
  useEffect(() => {
    if (variantSearch.length >= 2) {
      api.listVariants(shop, 20, 0, variantSearch)
        .then(data => setVariants(data.variants))
        .catch(console.error);
    }
  }, [shop, variantSearch]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!variantId) return;

    setFormLoading(true);
    try {
      await api.createOverride({
        shopDomain: shop,
        scopeType,
        scopeValue: scopeType === 'global' ? undefined : scopeValue,
        variantId,
        action,
        weight: parseFloat(weight),
      });
      await fetchData();
      setShowForm(false);
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create override');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deleteOverride(id);
      setOverrides(overrides.filter(o => o.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete override');
    }
  };

  const resetForm = () => {
    setScopeType('global');
    setScopeValue('');
    setVariantId('');
    setAction('boost');
    setWeight('1.5');
    setVariantSearch('');
  };

  const getDefaultWeight = (act: string): string => {
    switch (act) {
      case 'pin': return '1.0';
      case 'boost': return '1.5';
      case 'demote': return '0.5';
      case 'exclude': return '0';
      default: return '1.0';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Manual Overrides</h1>
          <p className="text-muted-foreground">
            Control search ranking for specific products
          </p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Override
        </Button>
      </div>

      {error && (
        <Card className="mb-8 border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Create Override Form */}
      {showForm && (
        <Card className="mb-8">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Create Override</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowForm(false);
                  resetForm();
                }}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            <CardDescription>
              Define how a product should be ranked in search results
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="scopeType">Scope Type</Label>
                  <Select value={scopeType} onValueChange={setScopeType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="global">Global</SelectItem>
                      <SelectItem value="query">Query</SelectItem>
                      <SelectItem value="category">Category</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {scopeType !== 'global' && (
                  <div className="space-y-2">
                    <Label htmlFor="scopeValue">
                      {scopeType === 'query' ? 'Query Term' : 'Product Type'}
                    </Label>
                    <Input
                      id="scopeValue"
                      value={scopeValue}
                      onChange={(e) => setScopeValue(e.target.value)}
                      placeholder={
                        scopeType === 'query'
                          ? 'e.g., summer shirts'
                          : 'e.g., T-Shirts'
                      }
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="action">Action</Label>
                  <Select
                    value={action}
                    onValueChange={(v) => {
                      setAction(v);
                      setWeight(getDefaultWeight(v));
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pin">Pin to Top</SelectItem>
                      <SelectItem value="boost">Boost</SelectItem>
                      <SelectItem value="demote">Demote</SelectItem>
                      <SelectItem value="exclude">Exclude</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {(action === 'boost' || action === 'demote') && (
                  <div className="space-y-2">
                    <Label htmlFor="weight">Weight</Label>
                    <Input
                      id="weight"
                      type="number"
                      step="0.1"
                      min="0"
                      max="10"
                      value={weight}
                      onChange={(e) => setWeight(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      {action === 'boost'
                        ? 'Values > 1 increase ranking'
                        : 'Values < 1 decrease ranking'}
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="variantSearch">Product Variant</Label>
                <Input
                  id="variantSearch"
                  placeholder="Search products..."
                  value={variantSearch}
                  onChange={(e) => setVariantSearch(e.target.value)}
                />
                {variants.length > 0 && (
                  <div className="border rounded-md max-h-48 overflow-y-auto">
                    {variants.map((v) => (
                      <button
                        key={v.id}
                        type="button"
                        className={`w-full px-3 py-2 text-left text-sm hover:bg-slate-50 ${
                          variantId === v.variantId ? 'bg-primary/10' : ''
                        }`}
                        onClick={() => setVariantId(v.variantId)}
                      >
                        <div className="font-medium">{v.title}</div>
                        {v.variantTitle && (
                          <div className="text-muted-foreground text-xs">
                            {v.variantTitle}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
                {variantId && (
                  <p className="text-xs text-muted-foreground">
                    Selected: {variantId}
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowForm(false);
                    resetForm();
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={formLoading || !variantId}>
                  {formLoading && (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  )}
                  Create Override
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Overrides List */}
      <Card>
        <CardHeader>
          <CardTitle>Active Overrides</CardTitle>
          <CardDescription>
            {overrides.length} override{overrides.length !== 1 ? 's' : ''} configured
          </CardDescription>
        </CardHeader>
        <CardContent>
          {overrides.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No overrides configured. Click &quot;Add Override&quot; to create one.
            </p>
          ) : (
            <div className="space-y-3">
              {overrides.map((override) => {
                const Icon = actionIcons[override.action as keyof typeof actionIcons];
                const colorClass = actionColors[override.action as keyof typeof actionColors];
                return (
                  <div
                    key={override.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`p-2 rounded-lg ${colorClass}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium capitalize">
                            {override.action}
                          </span>
                          {override.action !== 'pin' && override.action !== 'exclude' && (
                            <Badge variant="outline">
                              {override.weight}x
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {override.scopeType === 'global'
                            ? 'All searches'
                            : `${override.scopeType}: "${override.scopeValue}"`}
                        </p>
                        <p className="text-xs text-muted-foreground truncate max-w-md">
                          {override.variantId}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(override.id)}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
