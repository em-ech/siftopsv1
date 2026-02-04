'use client';

import { useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Search, AlertCircle, ArrowLeft, CheckCircle2 } from 'lucide-react';

export default function InstallPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const error = searchParams.get('error');
  const shopParam = searchParams.get('shop');

  const [shop, setShop] = useState(shopParam || '');
  const [loading, setLoading] = useState(false);
  const [validationError, setValidationError] = useState('');

  const validateShopDomain = (domain: string): boolean => {
    // Add .myshopify.com if not present
    const fullDomain = domain.includes('.myshopify.com')
      ? domain
      : `${domain}.myshopify.com`;

    const regex = /^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/;
    return regex.test(fullDomain);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError('');

    if (!shop) {
      setValidationError('Please enter your shop domain');
      return;
    }

    const normalizedShop = shop.includes('.myshopify.com')
      ? shop
      : `${shop}.myshopify.com`;

    if (!validateShopDomain(normalizedShop)) {
      setValidationError('Invalid shop domain format');
      return;
    }

    setLoading(true);

    // Redirect to API install endpoint
    window.location.href = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/auth/install?shop=${encodeURIComponent(normalizedShop)}`;
  };

  const handleDemoMode = () => {
    router.push('/dashboard?shop=demo-store.myshopify.com');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex flex-col">
      {/* Navigation */}
      <nav className="border-b bg-white/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 h-16 flex items-center">
          <Link href="/" className="flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" />
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Search className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-xl">Sift</span>
          </Link>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="w-16 h-16 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Search className="w-8 h-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">Install Sift</CardTitle>
            <CardDescription>
              Connect your Shopify store to start using intelligent search
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="bg-destructive/10 text-destructive rounded-lg p-4 mb-6 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Installation failed</p>
                  <p className="text-sm opacity-90">
                    {error === 'oauth_failed'
                      ? 'OAuth authentication failed. Please try again.'
                      : 'An error occurred during installation.'}
                  </p>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="shop">Shop Domain</Label>
                <div className="flex gap-2">
                  <Input
                    id="shop"
                    placeholder="your-store"
                    value={shop}
                    onChange={(e) => setShop(e.target.value)}
                    className="flex-1"
                  />
                  <span className="flex items-center text-sm text-muted-foreground">
                    .myshopify.com
                  </span>
                </div>
                {validationError && (
                  <p className="text-sm text-destructive">{validationError}</p>
                )}
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Redirecting...' : 'Install App'}
              </Button>
            </form>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">Or</span>
              </div>
            </div>

            <Button
              variant="outline"
              className="w-full"
              onClick={handleDemoMode}
            >
              Try Demo Mode
            </Button>

            <div className="mt-6 space-y-3">
              <p className="text-xs text-muted-foreground text-center">
                Sift will request the following permissions:
              </p>
              <div className="grid gap-2 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  Read product data
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  Read inventory levels
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  Read metafields
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  Read publications
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
