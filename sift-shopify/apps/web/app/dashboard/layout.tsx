'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Search,
  LayoutDashboard,
  BarChart3,
  Settings2,
  ChevronDown,
  Store,
} from 'lucide-react';
import { api, Shop } from '@/lib/api';

const navItems = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/dashboard/search', label: 'Search Console', icon: Search },
  { href: '/dashboard/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/dashboard/overrides', label: 'Overrides', icon: Settings2 },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const shopParam = searchParams.get('shop');

  const [shops, setShops] = useState<Shop[]>([]);
  const [selectedShop, setSelectedShop] = useState<string>(
    shopParam || 'demo-store.myshopify.com'
  );
  const [showShopDropdown, setShowShopDropdown] = useState(false);

  useEffect(() => {
    api.listShops().then(setShops).catch(console.error);
  }, []);

  // Append shop param to nav links
  const getNavHref = (href: string) => {
    return `${href}?shop=${encodeURIComponent(selectedShop)}`;
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r flex flex-col">
        <div className="p-4 border-b">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Search className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-xl">Sift</span>
          </Link>
        </div>

        {/* Shop Selector */}
        <div className="p-4 border-b">
          <div className="relative">
            <Button
              variant="outline"
              className="w-full justify-between"
              onClick={() => setShowShopDropdown(!showShopDropdown)}
            >
              <div className="flex items-center gap-2 truncate">
                <Store className="w-4 h-4 flex-shrink-0" />
                <span className="truncate">{selectedShop.replace('.myshopify.com', '')}</span>
              </div>
              <ChevronDown className="w-4 h-4 flex-shrink-0" />
            </Button>
            {showShopDropdown && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-md shadow-lg z-50">
                {shops.length === 0 ? (
                  <div className="p-3 text-sm text-muted-foreground">
                    No shops installed
                  </div>
                ) : (
                  shops.map((shop) => (
                    <button
                      key={shop.id}
                      className={cn(
                        'w-full px-3 py-2 text-left text-sm hover:bg-slate-50',
                        shop.shopDomain === selectedShop && 'bg-slate-50'
                      )}
                      onClick={() => {
                        setSelectedShop(shop.shopDomain);
                        setShowShopDropdown(false);
                      }}
                    >
                      {shop.shopDomain.replace('.myshopify.com', '')}
                    </button>
                  ))
                )}
                <div className="border-t">
                  <Link
                    href="/install"
                    className="block px-3 py-2 text-sm text-primary hover:bg-slate-50"
                    onClick={() => setShowShopDropdown(false)}
                  >
                    + Install new shop
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4">
          <ul className="space-y-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <li key={item.href}>
                  <Link
                    href={getNavHref(item.href)}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:bg-slate-100'
                    )}
                  >
                    <item.icon className="w-5 h-5" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Footer */}
        <div className="p-4 border-t">
          <p className="text-xs text-muted-foreground">
            Sift v1.0.0
          </p>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
