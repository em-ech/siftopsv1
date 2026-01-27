import { useState } from 'react';
import { Search, Lock, Trash2, Send, Loader2, ExternalLink } from 'lucide-react';
import { TCTopBar } from './TCTopBar';
import { TCResultCard } from './TCResultCard';
import { BundleDrawer } from './BundleDrawer';
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

      <main className="max-w-[1200px] mx-auto px-4 py-6 pb-10">
        <div className="flex gap-10 justify-center">
          {/* Left column - Search results (narrower) */}
          <div className="w-[500px] flex-shrink-0">
            {/* Header */}
            <h1 className="text-3xl font-bold text-foreground mb-1">SiftOps</h1>
            <p className="text-sm text-muted-foreground mb-4">
              Semantic search with evidence-based RAG
            </p>

            {/* Search row */}
            <form onSubmit={handleSearch} className="flex gap-2 items-center mb-2">
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
            </form>

            {/* Found count - under search bar */}
            {query && (
              <p className="text-sm text-muted-foreground mb-4">
                {foundCount > 0
                  ? `Found ${foundCount} result${foundCount !== 1 ? 's' : ''} for "${query}"`
                  : `No results for "${query}"`}
              </p>
            )}

            {/* Results list */}
            <div className="flex flex-col gap-4">
              {searchReason === 'low_confidence' || searchReason === 'no_matches' ? (
                <p className="text-sm text-muted-foreground">No relevant source found</p>
              ) : searchReason === 'not_indexed' ? (
                <p className="text-sm text-muted-foreground">
                  No content indexed yet.
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

          {/* Right column - Combined Evidence Bundle + Ask panel (wider, blue border) */}
          <div className="w-[480px] flex-shrink-0 hidden lg:block pt-[140px]">
            <div className="sticky top-20">
              <CombinedBundleAskPanel
                bundleDocIds={bundle?.docIds || []}
                results={results}
                locked={bundle?.locked || false}
                onRemove={onRemoveFromBundle}
                onClear={onClearBundle}
                onLock={onLockBundle}
                ragResponse={ragResponse}
                isAsking={isAsking}
                onAsk={onAsk}
              />
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

// Combined Evidence Bundle + Ask panel
function CombinedBundleAskPanel({
  bundleDocIds,
  results,
  locked,
  onRemove,
  onClear,
  onLock,
  ragResponse,
  isAsking,
  onAsk,
}: {
  bundleDocIds: string[];
  results: SearchResult[];
  locked: boolean;
  onRemove: (docId: string) => void;
  onClear: () => void;
  onLock: () => void;
  ragResponse: RAGResponse | null;
  isAsking: boolean;
  onAsk: (question: string) => void;
}) {
  const [question, setQuestion] = useState('');

  const bundleItems = bundleDocIds.map((docId) => {
    const result = results.find((r) => r.docId === docId);
    return { docId, title: result?.title || docId };
  });

  const handleAskSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (question.trim() && locked) {
      onAsk(question);
    }
  };

  return (
    <div className="rounded-xl border-2 border-primary/40 bg-card p-5">
      {/* Header */}
      <h4 className="font-semibold text-lg mb-4 text-foreground">Evidence Bundle</h4>

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
      <div className="flex gap-3 mb-4">
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
        <div className="flex flex-col gap-2 max-h-32 overflow-auto mb-4">
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
        <p className="text-sm text-muted-foreground text-center py-3 mb-4">
          Add sources from search results
        </p>
      )}

      {/* Divider */}
      <div className="border-t border-border my-4" />

      {/* Ask section */}
      <div>
        <h4 className="font-semibold text-base mb-2 text-foreground">Ask Your Sources</h4>
        {locked ? (
          <p className="text-sm text-muted-foreground mb-3">
            RAG enabled with locked evidence
          </p>
        ) : (
          <p className="text-sm text-muted-foreground mb-3">
            Lock the bundle to enable AI-assisted answers
          </p>
        )}

        {/* Question input */}
        <form onSubmit={handleAskSubmit}>
          <div className="flex gap-2 items-end">
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder={locked ? "Ask a question..." : "Lock bundle first..."}
              rows={2}
              disabled={!locked || isAsking}
              className="flex-1 px-3 py-3 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <button
              type="submit"
              disabled={!question.trim() || !locked || isAsking}
              className="h-12 w-12 rounded-lg bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isAsking ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </button>
          </div>
        </form>

        {/* Answer display */}
        {ragResponse && (
          <div className="mt-4 space-y-3 animate-slide-up">
            <div>
              <h5 className="text-xs font-medium text-muted-foreground mb-2">Answer</h5>
              <div className="text-sm text-foreground leading-relaxed">
                {ragResponse.answer}
              </div>
            </div>

            {ragResponse.citations.length > 0 && (
              <div>
                <h5 className="text-xs font-medium text-muted-foreground mb-2">Citations</h5>
                <div className="space-y-2">
                  {ragResponse.citations.map((citation) => (
                    <div
                      key={citation.citation}
                      className="p-3 rounded-lg border border-border bg-secondary/30"
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="px-1.5 py-0.5 rounded bg-primary text-primary-foreground text-xs font-mono font-medium">
                          {citation.citation}
                        </span>
                        <a
                          href={citation.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline flex items-center gap-1 truncate"
                        >
                          {citation.title || citation.url}
                          <ExternalLink className="w-3 h-3 flex-shrink-0" />
                        </a>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                        {citation.excerpt}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
