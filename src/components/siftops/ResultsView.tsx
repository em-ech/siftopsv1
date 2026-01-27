import { useState } from 'react';
import { Search, RefreshCw, X, Lock } from 'lucide-react';
import { TCTopBar } from './TCTopBar';
import { TCResultCard } from './TCResultCard';
import { BundleDrawer } from './BundleDrawer';
import { AskPanel } from './AskPanel';
import { SearchResult, Bundle, RAGResponse } from '@/types/siftops';

interface ResultsViewProps {
  query: string;
  results: SearchResult[];
  searchReason: string | null;
  isSearching: boolean;
  onSearch: (query: string) => void;
  isSyncing: boolean;
  onSync: () => void;
  bundle: Bundle | null;
  onCreateBundle: () => void;
  onAddToBundle: (docId: string) => void;
  onRemoveFromBundle: (docId: string) => void;
  onLockBundle: () => void;
  onClearBundle: () => void;
  ragResponse: RAGResponse | null;
  isAsking: boolean;
  onAsk: (question: string) => void;
}

function titleCase(s: string): string {
  return s
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function ResultsView({
  query,
  results,
  searchReason,
  isSearching,
  onSearch,
  isSyncing,
  onSync,
  bundle,
  onCreateBundle,
  onAddToBundle,
  onRemoveFromBundle,
  onLockBundle,
  onClearBundle,
  ragResponse,
  isAsking,
  onAsk,
}: ResultsViewProps) {
  const [localQuery, setLocalQuery] = useState(query);
  const [drawerVisible, setDrawerVisible] = useState(true);

  const handleSearch = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (localQuery.trim()) {
      onSearch(localQuery);
    }
  };

  const handleAddToBundle = async (docId: string) => {
    if (!bundle) {
      await onCreateBundle();
    }
    onAddToBundle(docId);
    setDrawerVisible(true);
  };

  const foundCount = results.length;
  const displayTitle = query ? titleCase(query) : 'Search';

  return (
    <div className="min-h-screen bg-background">
      <TCTopBar />

      <main className="max-w-[1280px] mx-auto px-4 py-5 pb-10">
        <div className="flex gap-6">
          {/* Left column - Search results */}
          <div className="flex-1 min-w-0">
            {/* Query title */}
            <h1 className="text-5xl md:text-6xl font-extrabold leading-none mt-5 mb-2.5 tracking-tight" style={{ letterSpacing: '-1.2px' }}>
              {displayTitle}
            </h1>

            {/* Found count */}
            <p className="text-sm text-muted-foreground mb-3.5">
              {foundCount > 0
                ? `Found ${foundCount} result${foundCount !== 1 ? 's' : ''}.`
                : 'Found 0 results.'}
            </p>

            {/* Search row */}
            <form onSubmit={handleSearch} className="flex gap-2.5 items-center mb-4">
              <input
                type="text"
                value={localQuery}
                onChange={(e) => setLocalQuery(e.target.value)}
                placeholder="Search TechCrunch"
                className="flex-1 px-4 py-3 border border-border rounded-full text-base bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-shadow"
              />
              <button
                type="submit"
                disabled={isSearching || !localQuery.trim()}
                className="px-4 py-2.5 bg-foreground text-background rounded-full text-sm font-medium border border-foreground hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Search className="w-4 h-4" />
                {isSearching ? 'Searching...' : 'Search'}
              </button>
              <button
                type="button"
                onClick={onSync}
                disabled={isSyncing}
                className="px-4 py-2.5 bg-secondary text-secondary-foreground rounded-full text-sm font-medium border border-border hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                Sync
              </button>
            </form>

            {/* Results list */}
            <div className="flex flex-col gap-4 mt-3.5">
              {searchReason === 'low_confidence' || searchReason === 'no_matches' ? (
                <p className="text-sm text-muted-foreground">No relevant source found</p>
              ) : searchReason === 'not_indexed' ? (
                <p className="text-sm text-muted-foreground">
                  No content indexed yet. Click "Sync" to start.
                </p>
              ) : results.length === 0 && query ? (
                <p className="text-sm text-muted-foreground">No results found for "{query}"</p>
              ) : null}

              {results.map((result) => (
                <TCResultCard
                  key={result.docId}
                  result={result}
                  isInBundle={bundle?.docIds.includes(result.docId) || false}
                  bundleLocked={bundle?.locked || false}
                  onAddToBundle={handleAddToBundle}
                />
              ))}
            </div>
          </div>

          {/* Right column - Bundle + Ask panel */}
          <div className="w-80 flex-shrink-0 hidden lg:block">
            <div className="sticky top-5 space-y-4">
              {/* Bundle panel */}
              {bundle && bundle.docIds.length > 0 ? (
                <BundleSidePanel
                  bundleDocIds={bundle.docIds}
                  results={results}
                  locked={bundle.locked}
                  onRemove={onRemoveFromBundle}
                  onClear={onClearBundle}
                  onLock={onLockBundle}
                />
              ) : (
                <div className="border border-dashed border-border rounded-lg p-4 text-center">
                  <p className="text-sm text-muted-foreground">
                    Add sources to build an evidence bundle
                  </p>
                </div>
              )}

              {/* Ask panel - only when bundle exists */}
              {bundle && bundle.docIds.length > 0 && (
                <AskPanel
                  isLocked={bundle.locked}
                  ragResponse={ragResponse}
                  isAsking={isAsking}
                  onAsk={onAsk}
                />
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Mobile drawer fallback */}
      {bundle && bundle.docIds.length > 0 && drawerVisible && (
        <div className="lg:hidden">
          <BundleDrawer
            bundleDocIds={bundle.docIds}
            results={results}
            locked={bundle.locked}
            onRemove={onRemoveFromBundle}
            onClear={onClearBundle}
            onLock={onLockBundle}
            onClose={() => setDrawerVisible(false)}
          />
        </div>
      )}
    </div>
  );
}

// Side panel version of Bundle (non-floating)
function BundleSidePanel({
  bundleDocIds,
  results,
  locked,
  onRemove,
  onClear,
  onLock,
}: {
  bundleDocIds: string[];
  results: SearchResult[];
  locked: boolean;
  onRemove: (docId: string) => void;
  onClear: () => void;
  onLock: () => void;
}) {
  const bundleItems = bundleDocIds.map((docId) => {
    const result = results.find((r) => r.docId === docId);
    return { docId, title: result?.title || docId };
  });

  return (
    <div className={`rounded-lg p-4 border-2 ${
      locked 
        ? 'bg-emerald-50 border-emerald-300' 
        : 'bg-background border-primary/30'
    }`}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <div className={`w-2 h-2 rounded-full ${locked ? 'bg-emerald-500' : 'bg-primary animate-pulse'}`} />
        <h4 className="font-bold text-sm">Evidence Bundle</h4>
        <span className={`ml-auto text-xs px-2 py-0.5 rounded-full ${
          locked 
            ? 'bg-emerald-200 text-emerald-800' 
            : 'bg-primary/10 text-primary'
        }`}>
          {bundleDocIds.length}
        </span>
      </div>

      {/* List */}
      <div className="flex flex-col gap-2 max-h-48 overflow-auto">
        {bundleItems.map(({ docId, title }) => (
          <div
            key={docId}
            className={`text-xs border rounded-lg p-2 flex items-start gap-2 ${
              locked 
                ? 'bg-white border-emerald-200 text-emerald-900' 
                : 'bg-background border-border text-foreground'
            }`}
          >
            <span className="flex-1 line-clamp-2">{title}</span>
            {!locked && (
              <button
                onClick={() => onRemove(docId)}
                className="p-1 rounded hover:bg-destructive/10 transition-colors flex-shrink-0"
              >
                <X className="w-3 h-3 text-muted-foreground hover:text-destructive" />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="mt-3 flex gap-2">
        {!locked ? (
          <>
            <button
              onClick={onClear}
              className="px-3 py-1.5 rounded-full text-xs font-medium border border-border bg-secondary hover:bg-destructive/10 hover:text-destructive transition-colors"
            >
              Clear
            </button>
            <button
              onClick={onLock}
              className="px-3 py-1.5 rounded-full text-xs font-medium bg-emerald-600 text-white hover:bg-emerald-700 transition-colors flex items-center gap-1"
            >
              <Lock className="w-3 h-3" />
              Lock
            </button>
          </>
        ) : (
          <div className="flex items-center gap-2 w-full">
            <span className="text-xs text-emerald-700 flex items-center gap-1">
              <Lock className="w-3 h-3" />
              Locked
            </span>
            <button
              onClick={onClear}
              className="ml-auto px-2 py-1 rounded text-xs text-muted-foreground hover:text-destructive transition-colors"
            >
              Unlock
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
