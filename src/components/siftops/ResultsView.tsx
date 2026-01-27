import { useState } from 'react';
import { Search, RefreshCw } from 'lucide-react';
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

      <main className="max-w-[980px] mx-auto px-4 py-5 pb-10">
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

        {/* RAG section - only when bundle is locked */}
        {bundle?.locked && (
          <div className="mt-8">
            <AskPanel
              isLocked={bundle.locked}
              ragResponse={ragResponse}
              isAsking={isAsking}
              onAsk={onAsk}
            />
          </div>
        )}
      </main>

      {/* Bundle drawer */}
      {bundle && drawerVisible && (
        <BundleDrawer
          bundleDocIds={bundle.docIds}
          results={results}
          locked={bundle.locked}
          onRemove={onRemoveFromBundle}
          onClear={onClearBundle}
          onLock={onLockBundle}
          onClose={() => setDrawerVisible(false)}
        />
      )}
    </div>
  );
}
