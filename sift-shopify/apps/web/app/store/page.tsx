'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Search, X } from 'lucide-react';
import Image from 'next/image';

interface Product {
  variantId: string;
  productId: string;
  handle: string;
  title: string;
  variantTitle: string | null;
  vendor: string;
  productType: string;
  price: string;
  currency: string;
  available: boolean;
  inventoryQuantity: number | null;
  imageUrl: string | null;
  options: Record<string, string>;
  score: number;
}

interface SearchResponse {
  results: Product[];
  query: string;
  totalResults: number;
}

const productImages: Record<string, string> = {
  'boy-brow': 'https://images.unsplash.com/photo-1631214524020-7e18db9a8f92?w=600&h=750&fit=crop',
  'cloud-paint': 'https://images.unsplash.com/photo-1586495777744-4413f21062fa?w=600&h=750&fit=crop',
  'milky-jelly-cleanser': 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=600&h=750&fit=crop',
  'priming-moisturizer': 'https://images.unsplash.com/photo-1611930022073-b7a4ba5fcccd?w=600&h=750&fit=crop',
  'balm-dotcom': 'https://images.unsplash.com/photo-1599305090598-fe179d501227?w=600&h=750&fit=crop',
  'futuredew': 'https://images.unsplash.com/photo-1617897903246-719242758050?w=600&h=750&fit=crop',
  'lash-slick': 'https://images.unsplash.com/photo-1631214500115-598fc2cb8d2c?w=600&h=750&fit=crop',
  'stretch-concealer': 'https://images.unsplash.com/photo-1590156546946-ce55a12a6a5f?w=600&h=750&fit=crop',
  'you-perfume': 'https://images.unsplash.com/photo-1594035910387-fea47794261f?w=600&h=750&fit=crop',
  'super-pure': 'https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?w=600&h=750&fit=crop',
  'super-bounce': 'https://images.unsplash.com/photo-1570194065650-d99fb4b38b15?w=600&h=750&fit=crop',
  'super-glow': 'https://images.unsplash.com/photo-1598440947619-2c35fc9aa908?w=600&h=750&fit=crop',
  'generation-g': 'https://images.unsplash.com/photo-1586495777744-4413f21062fa?w=600&h=750&fit=crop',
  'skin-tint': 'https://images.unsplash.com/photo-1557205465-f3762edea6d3?w=600&h=750&fit=crop',
  'haloscope': 'https://images.unsplash.com/photo-1599733589046-10c874bce7c3?w=600&h=750&fit=crop',
  'default': 'https://images.unsplash.com/photo-1571781926291-c477ebfd024b?w=600&h=750&fit=crop',
};

function getProductImage(handle: string): string {
  return productImages[handle] || productImages.default;
}

export default function StorePage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const search = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    setIsLoading(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const response = await fetch(
        `${apiUrl}/proxy/search?shop=glossier.myshopify.com&q=${encodeURIComponent(searchQuery)}`
      );
      const data: SearchResponse = await response.json();

      // Dedupe by product
      const seen = new Set<string>();
      const unique = data.results?.filter(p => {
        if (seen.has(p.productId)) return false;
        seen.add(p.productId);
        return true;
      }) || [];

      setResults(unique);
    } catch (error) {
      console.error('Search error:', error);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (query) search(query);
    }, 300);
    return () => clearTimeout(timer);
  }, [query, search]);

  useEffect(() => {
    if (isSearchOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isSearchOpen]);

  const openSearch = () => {
    setIsSearchOpen(true);
  };

  const closeSearch = () => {
    setIsSearchOpen(false);
    setQuery('');
    setResults([]);
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      {/* Minimal Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#FAFAFA]">
        <div className="flex items-center justify-between px-8 py-6">
          <div className="w-24" />
          <h1 className="text-[13px] tracking-[0.3em] font-normal text-neutral-900">
            SIFT
          </h1>
          <button
            onClick={openSearch}
            className="w-24 flex justify-end"
          >
            <Search className="w-[18px] h-[18px] text-neutral-600 hover:text-neutral-900 transition-colors" />
          </button>
        </div>
      </header>

      {/* Search Overlay */}
      {isSearchOpen && (
        <div className="fixed inset-0 z-[100] bg-[#FAFAFA]">
          <div className="h-full flex flex-col">
            {/* Search Header */}
            <div className="flex items-center justify-between px-8 py-6 border-b border-neutral-200">
              <div className="w-24" />
              <div className="flex-1 max-w-md mx-auto">
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search"
                  className="w-full text-center text-[15px] tracking-wide bg-transparent border-none outline-none placeholder:text-neutral-400"
                />
              </div>
              <button
                onClick={closeSearch}
                className="w-24 flex justify-end"
              >
                <X className="w-[18px] h-[18px] text-neutral-600 hover:text-neutral-900 transition-colors" />
              </button>
            </div>

            {/* Search Results */}
            <div className="flex-1 overflow-y-auto">
              {isLoading && (
                <div className="flex justify-center py-24">
                  <div className="w-5 h-5 border border-neutral-300 border-t-neutral-900 rounded-full animate-spin" />
                </div>
              )}

              {!isLoading && query && results.length === 0 && (
                <div className="flex flex-col items-center justify-center py-24">
                  <p className="text-[13px] text-neutral-500 tracking-wide">No results</p>
                </div>
              )}

              {!isLoading && results.length > 0 && (
                <div className="px-8 py-12">
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-12">
                    {results.slice(0, 8).map((product) => (
                      <ProductCard key={product.variantId} product={product} />
                    ))}
                  </div>
                </div>
              )}

              {!query && (
                <div className="flex flex-col items-center justify-center py-24">
                  <p className="text-[13px] text-neutral-400 tracking-wide">
                    Try &ldquo;serum&rdquo; or &ldquo;lip&rdquo;
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Hero */}
      <main className="pt-24">
        <section className="h-[85vh] flex flex-col items-center justify-center px-8">
          <p className="text-[11px] tracking-[0.25em] text-neutral-500 mb-6">
            THE EDIT
          </p>
          <h2 className="text-[clamp(2rem,5vw,3.5rem)] font-light text-neutral-900 tracking-tight text-center leading-tight">
            Essentials
          </h2>
        </section>

        {/* Featured Grid */}
        <section className="px-8 pb-24">
          <div className="grid grid-cols-2 gap-4">
            <div
              className="aspect-[3/4] relative cursor-pointer group"
              onClick={openSearch}
            >
              <Image
                src="https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=800&h=1000&fit=crop"
                alt="Skincare"
                fill
                className="object-cover"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
              <div className="absolute bottom-6 left-6">
                <p className="text-[11px] tracking-[0.2em] text-white/80">01</p>
                <p className="text-[13px] tracking-wide text-white mt-1">Skincare</p>
              </div>
            </div>
            <div
              className="aspect-[3/4] relative cursor-pointer group"
              onClick={openSearch}
            >
              <Image
                src="https://images.unsplash.com/photo-1512496015851-a90fb38ba796?w=800&h=1000&fit=crop"
                alt="Makeup"
                fill
                className="object-cover"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
              <div className="absolute bottom-6 left-6">
                <p className="text-[11px] tracking-[0.2em] text-white/80">02</p>
                <p className="text-[13px] tracking-wide text-white mt-1">Makeup</p>
              </div>
            </div>
          </div>
        </section>

        {/* Single Feature */}
        <section className="px-8 pb-32">
          <div
            className="aspect-[16/9] md:aspect-[21/9] relative cursor-pointer group"
            onClick={openSearch}
          >
            <Image
              src="https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=1600&h=700&fit=crop"
              alt="Collection"
              fill
              className="object-cover"
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
            <div className="absolute bottom-8 left-8">
              <p className="text-[11px] tracking-[0.2em] text-white/80 mb-2">FEATURED</p>
              <p className="text-[15px] tracking-wide text-white">The Serums</p>
            </div>
          </div>
        </section>
      </main>

      {/* Minimal Footer */}
      <footer className="border-t border-neutral-200 px-8 py-12">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <p className="text-[11px] tracking-[0.2em] text-neutral-500">
            SIFT
          </p>
          <div className="flex gap-8">
            <a href="#" className="text-[12px] text-neutral-500 hover:text-neutral-900 transition-colors">
              Shop
            </a>
            <a href="#" className="text-[12px] text-neutral-500 hover:text-neutral-900 transition-colors">
              About
            </a>
            <a href="#" className="text-[12px] text-neutral-500 hover:text-neutral-900 transition-colors">
              Contact
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function ProductCard({ product }: { product: Product }) {
  const imageUrl = getProductImage(product.handle);

  return (
    <div className="group cursor-pointer">
      <div className="aspect-[3/4] relative mb-4 overflow-hidden bg-neutral-100">
        <Image
          src={imageUrl}
          alt={product.title}
          fill
          className="object-cover group-hover:scale-[1.02] transition-transform duration-700"
        />
      </div>
      <p className="text-[12px] tracking-wide text-neutral-900">
        {product.title}
      </p>
      <p className="text-[12px] text-neutral-500 mt-1">
        ${parseFloat(product.price).toFixed(0)}
      </p>
    </div>
  );
}
