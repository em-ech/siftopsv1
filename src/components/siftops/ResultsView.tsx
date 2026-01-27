import { useState } from 'react';
import { Search, RefreshCw, X, Lock, Trash2 } from 'lucide-react';
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
  onCreateBundle: () => Promise<string | null>;
  onAddToBundle: (docId: string, bundleId?: string) => void;
  onRemoveFromBundle: (docId: string) => void;
  onLockBundle: () => void;
  onClearBundle: () => void;
  ragResponse: RAGResponse | null;
  isAsking: boolean;
  onAsk: (question: string) => void;
  onGoHome: () => void;
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
  onGoHome,
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
    let bundleId = bundle?.bundleId;
    if (!bundleId) {
      bundleId = await onCreateBundle();
      if (!bundleId) return;
    }
    onAddToBundle(docId, bundleId);
    setDrawerVisible(true);
  };

  const foundCount = results.length;

  return (
    <div className="min-h-screen bg-background">
      <TCTopBar onGoHome={onGoHome} />

      <main className="max-w-[1280px] mx-auto px-4 py-6 pb-10">
        <div className="flex gap-6">
          {/* Left column - Search results */}
          <div className="flex-1 min-w-0">
            {/* Header */}
            <h1 className="text-3xl font-bold text-foreground mb-1">SiftOps</h1>
            <p className="text-sm text-muted-foreground mb-4">
              Semantic search with evidence-based RAG
            </p>

            {/* Found count */}
            {query && (
              <p className="text-sm text-muted-foreground mb-3">
                {foundCount > 0
                  ? `Found ${foundCount} result${foundCount !== 1 ? 's' : ''} for "${query}"`
                  : `No results for "${query}"`}
              </p>
            )}

            {/* Search row */}
            <form onSubmit={handleSearch} className="flex gap-2 items-center mb-5">
              <input
                type="text"
                value={localQuery}
                onChange={(e) => setLocalQuery(e.target.value)}
                placeholder="Search sources..."
                className="flex-1 px-4 py-2.5 border border-border rounded-lg text-sm bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
              />
              <button
                type="submit"
                disabled={isSearching || !localQuery.trim()}
                className="px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Search className="w-4 h-4" />
                {isSearching ? 'Searching...' : 'Search'}
              </button>
              <button
                type="button"
                onClick={onSync}
                disabled={isSyncing}
                className="px-4 py-2.5 bg-secondary text-secondary-foreground rounded-lg text-sm font-medium border border-border hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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
          <div className="w-80 flex-shrink-0 hidden lg:block pt-[180px]">
            <div className="sticky top-24 space-y-4">
              {/* Bundle panel - always show */}
              <BundleSidePanel
                bundleDocIds={bundle?.docIds || []}
                results={results}
                locked={bundle?.locked || false}
                onRemove={onRemoveFromBundle}
                onClear={onClearBundle}
                onLock={onLockBundle}
              />

              {/* Ask panel - only when bundle is locked */}
              {bundle && bundle.locked && (
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
    <div className="rounded-lg border border-border bg-card p-5">
      {/* Header */}
      <h4 className="font-semibold text-base mb-4">Evidence Bundle</h4>

      {/* Status row */}
      <div className="flex items-center gap-2 mb-4">
        {locked ? (
          <span className="px-3 py-1 rounded-md bg-primary text-primary-foreground text-xs font-medium">
            Locked
          </span>
        ) : (
          <span className="px-3 py-1 rounded-md bg-muted text-muted-foreground text-xs font-medium">
            Unlocked
          </span>
        )}
        <span className="text-sm text-muted-foreground">
          {bundleDocIds.length} source{bundleDocIds.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Action buttons */}
      <div className="flex gap-3 mb-5">
        <button
          onClick={onLock}
          disabled={locked || bundleDocIds.length === 0}
          className="flex-1 px-4 py-2.5 rounded-lg border border-border bg-background text-sm font-medium flex items-center justify-center gap-2 hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Lock className="w-4 h-4" />
          Lock
        </button>
        <button
          onClick={onClear}
          className="flex-1 px-4 py-2.5 rounded-lg border border-border bg-background text-sm font-medium flex items-center justify-center gap-2 hover:bg-accent transition-colors"
        >
          <Trash2 className="w-4 h-4" />
          Clear
        </button>
      </div>

      {/* Source list */}
      {bundleItems.length > 0 ? (
        <div className="flex flex-col gap-2 max-h-48 overflow-auto">
          {bundleItems.map(({ docId, title }) => (
            <div
              key={docId}
              className="text-sm text-foreground py-2 px-3 bg-muted/50 rounded-lg truncate"
            >
              {title}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-2">
          Add sources from search results
        </p>
      )}
    </div>
  );
}
