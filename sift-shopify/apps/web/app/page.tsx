'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Search, Zap, BarChart3, Settings2, Shield, Sparkles } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Navigation */}
      <nav className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Search className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-xl">Sift</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/dashboard">
              <Button variant="ghost">Dashboard</Button>
            </Link>
            <Link href="/install">
              <Button>Install App</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 text-center">
        <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium mb-6">
          <Sparkles className="w-4 h-4" />
          Hybrid Search for Shopify
        </div>
        <h1 className="text-5xl md:text-6xl font-bold tracking-tight mb-6">
          Search that <span className="text-primary">understands</span>
          <br />your products
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
          Sift combines lexical full-text search with vector similarity to deliver
          highly relevant product results. Boost conversions with intelligent search.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link href="/install">
            <Button size="lg" className="gap-2">
              <Search className="w-5 h-5" />
              Get Started Free
            </Button>
          </Link>
          <Link href="/dashboard?shop=demo-store.myshopify.com">
            <Button size="lg" variant="outline">
              View Demo
            </Button>
          </Link>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold mb-4">Why Choose Sift?</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Built for modern Shopify stores that need more than basic keyword matching.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <Zap className="w-6 h-6 text-primary" />
              </div>
              <CardTitle>Hybrid Search</CardTitle>
              <CardDescription>
                Combines lexical and semantic search for the best of both worlds.
                Find products even when queries don&apos;t match exactly.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <div className="w-12 h-12 rounded-lg bg-green-100 flex items-center justify-center mb-4">
                <BarChart3 className="w-6 h-6 text-green-600" />
              </div>
              <CardTitle>A/B Testing Built-in</CardTitle>
              <CardDescription>
                Compare control vs treatment search variants. Measure click-through
                rates and conversions to prove ROI.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <div className="w-12 h-12 rounded-lg bg-purple-100 flex items-center justify-center mb-4">
                <Settings2 className="w-6 h-6 text-purple-600" />
              </div>
              <CardTitle>Manual Overrides</CardTitle>
              <CardDescription>
                Pin, boost, demote, or exclude products for specific queries.
                Take control of your search results.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <div className="w-12 h-12 rounded-lg bg-orange-100 flex items-center justify-center mb-4">
                <Shield className="w-6 h-6 text-orange-600" />
              </div>
              <CardTitle>No Hallucinations</CardTitle>
              <CardDescription>
                Search results come directly from your product data.
                We never invent facts about your products.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center mb-4">
                <Search className="w-6 h-6 text-blue-600" />
              </div>
              <CardTitle>Real-time Sync</CardTitle>
              <CardDescription>
                Webhooks keep your search index in sync with Shopify.
                Products, inventory, and collections update instantly.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <div className="w-12 h-12 rounded-lg bg-pink-100 flex items-center justify-center mb-4">
                <Sparkles className="w-6 h-6 text-pink-600" />
              </div>
              <CardTitle>Easy Integration</CardTitle>
              <CardDescription>
                Simple App Proxy endpoint. Add a snippet to your theme
                and start serving better search results immediately.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="container mx-auto px-4 py-20 bg-slate-50 -mx-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold mb-4">How It Works</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Get up and running in minutes with our simple setup process.
          </p>
        </div>

        <div className="max-w-3xl mx-auto">
          <div className="space-y-8">
            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center font-bold flex-shrink-0">
                1
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-2">Install the App</h3>
                <p className="text-muted-foreground">
                  Connect your Shopify store with OAuth. We&apos;ll request read-only
                  access to your products, inventory, and metafields.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center font-bold flex-shrink-0">
                2
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-2">Sync Your Catalog</h3>
                <p className="text-muted-foreground">
                  Trigger a bulk backfill to import all your products. Even large
                  catalogs with tens of thousands of variants sync efficiently.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center font-bold flex-shrink-0">
                3
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-2">Configure App Proxy</h3>
                <p className="text-muted-foreground">
                  Set up the Shopify App Proxy to route search requests through Sift.
                  Your storefront calls /apps/sift/search for results.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center font-bold flex-shrink-0">
                4
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-2">Add Theme Snippet</h3>
                <p className="text-muted-foreground">
                  Copy our Liquid snippet and JavaScript to your theme. Customize
                  the styling to match your store&apos;s design.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-20 text-center">
        <h2 className="text-3xl font-bold mb-4">Ready to improve your search?</h2>
        <p className="text-muted-foreground max-w-xl mx-auto mb-8">
          Join stores that have already upgraded their search experience with Sift.
        </p>
        <Link href="/install">
          <Button size="lg">Start Free Trial</Button>
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-primary flex items-center justify-center">
                <Search className="w-4 h-4 text-white" />
              </div>
              <span className="font-semibold">Sift</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Intelligent search for Shopify storefronts
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
