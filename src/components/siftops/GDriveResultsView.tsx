import { useState } from 'react';
import { Search, Lock, Trash2, Send, Loader2, ExternalLink, ArrowLeft, Cloud, FileText, File, FileSpreadsheet, Plus, Check } from 'lucide-react';
import { GDriveSearchResult } from '@/types/gdrive';
import { Bundle, RAGResponse } from '@/types/siftops';

interface GDriveResultsViewProps {
  query: string;
  results: GDriveSearchResult[];
  searchReason: string | null;
  isSearching: boolean;
  onSearch: (query: string) => void;
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

function getMimeTypeLabel(mimeType: string): string {
  if (mimeType?.includes('document')) return 'Google Doc';
  if (mimeType?.includes('spreadsheet')) return 'Spreadsheet';
  if (mimeType?.includes('presentation')) return 'Slides';
  if (mimeType?.includes('pdf')) return 'PDF';
  if (mimeType?.includes('text')) return 'Text';
  return 'File';
}

function getMimeTypeIcon(mimeType: string) {
  if (mimeType?.includes('document')) return <FileText className="w-4 h-4" />;
  if (mimeType?.includes('spreadsheet')) return <FileSpreadsheet className="w-4 h-4" />;
  if (mimeType?.includes('pdf')) return <File className="w-4 h-4" />;
  return <File className="w-4 h-4" />;
}

export function GDriveResultsView({
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
}: GDriveResultsViewProps) {
  const [localQuery, setLocalQuery] = useState(query);
  const [question, setQuestion] = useState('');

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
  };

  const handleAskSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (question.trim() && bundle?.locked) {
      onAsk(question);
    }
  };

  const bundleItems = (bundle?.docIds || []).map((docId) => {
    const result = results.find((r) => r.docId === docId);
    return { docId, title: result?.title || docId };
  });

  const foundCount = results.length;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-background border-b border-border">
        <div className="max-w-[1200px] mx-auto px-4 py-3 flex items-center gap-3 mr-[5%]">
          <button
            onClick={onGoHome}
            className="p-2 rounded-lg hover:bg-accent transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-muted-foreground" />
          </button>
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Cloud className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="font-semibold text-lg text-foreground">Google Drive Search</h1>
            <p className="text-sm text-muted-foreground">Semantic search across your files</p>
          </div>
        </div>
      </header>

      <main className="max-w-[1200px] mx-auto px-4 py-6 pb-10 mr-[5%]">
        <div className="flex gap-10 justify-center">
          {/* Left column - Search results */}
          <div className="w-[700px] flex-shrink-0">
            {/* Search row */}
            <form onSubmit={handleSearch} className="flex gap-2 items-center mb-2">
              <input
                type="text"
                value={localQuery}
                onChange={(e) => setLocalQuery(e.target.value)}
                placeholder="Search Google Drive..."
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

            {/* Found count */}
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
                <p className="text-sm text-muted-foreground">No matching sources found in your Google Drive.</p>
              ) : searchReason === 'not_indexed' ? (
                <p className="text-sm text-muted-foreground">
                  No content indexed yet. Go back and click "Index Drive" to start.
                </p>
              ) : results.length === 0 && query ? (
                <p className="text-sm text-muted-foreground">No results found for "{query}"</p>
              ) : null}

              {results.map((result) => (
                <GDriveResultCard
                  key={result.docId}
                  result={result}
                  isInBundle={bundle?.docIds.includes(result.docId) || false}
                  bundleLocked={bundle?.locked || false}
                  onAddToBundle={handleAddToBundle}
                />
              ))}
            </div>
          </div>

          {/* Right column - Evidence Bundle + Ask panel */}
          <div className="w-[480px] flex-shrink-0 hidden lg:block pt-[72px]">
            <div className="sticky top-20">
              <div className="rounded-xl border-2 border-primary/40 bg-card p-5">
                {/* Header */}
                <h4 className="font-semibold text-lg mb-4 text-foreground">Evidence Bundle</h4>

                {/* Status row */}
                <div className="flex items-center gap-2 mb-4">
                  {bundle?.locked ? (
                    <span className="px-3 py-1 rounded-md bg-primary text-primary-foreground text-xs font-medium">
                      Locked
                    </span>
                  ) : (
                    <span className="px-3 py-1 rounded-md bg-muted text-muted-foreground text-xs font-medium">
                      Unlocked
                    </span>
                  )}
                  <span className="text-sm text-muted-foreground">
                    {(bundle?.docIds || []).length} source{(bundle?.docIds || []).length !== 1 ? 's' : ''}
                  </span>
                </div>

                {/* Action buttons */}
                <div className="flex gap-3 mb-4">
                  <button
                    onClick={onLockBundle}
                    disabled={bundle?.locked || (bundle?.docIds || []).length === 0}
                    className="flex-1 px-4 py-2.5 rounded-lg border border-border bg-background text-sm font-medium flex items-center justify-center gap-2 hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Lock className="w-4 h-4" />
                    Lock
                  </button>
                  <button
                    onClick={onClearBundle}
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
                  {bundle?.locked ? (
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
                        placeholder={bundle?.locked ? "Ask a question..." : "Lock bundle first..."}
                        rows={2}
                        disabled={!bundle?.locked || isAsking}
                        className="flex-1 px-3 py-3 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                      <button
                        type="submit"
                        disabled={!question.trim() || !bundle?.locked || isAsking}
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
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

// Result card component
function GDriveResultCard({
  result,
  isInBundle,
  bundleLocked,
  onAddToBundle,
}: {
  result: GDriveSearchResult;
  isInBundle: boolean;
  bundleLocked: boolean;
  onAddToBundle: (docId: string) => void;
}) {
  const scoreDisplay = (result.score * 100).toFixed(1);

  return (
    <div className="border border-border rounded-xl p-4 bg-card hover:border-primary/30 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* Header row */}
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-secondary text-xs text-secondary-foreground font-medium">
              {getMimeTypeIcon(result.mimeType)}
              {getMimeTypeLabel(result.mimeType)}
            </span>
            <span className="px-2 py-0.5 rounded bg-primary/10 text-primary text-xs font-medium">
              {scoreDisplay}%
            </span>
          </div>

          {/* Title */}
          <h3 className="font-medium text-foreground mb-1 leading-snug">
            {result.title}
          </h3>

          {/* Folder path */}
          {result.folderPath && (
            <p className="text-xs text-muted-foreground mb-1">
              📁 {result.folderPath}
            </p>
          )}

          {/* URL */}
          <a
            href={result.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline mb-2 max-w-full truncate"
          >
            <ExternalLink className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">Open in Google Drive</span>
          </a>

          {/* Snippet */}
          <p className="text-sm text-muted-foreground leading-relaxed">
            {result.snippet}
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-1.5 flex-shrink-0">
          <button
            onClick={() => onAddToBundle(result.docId)}
            disabled={bundleLocked || isInBundle}
            className={`px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors ${
              isInBundle
                ? 'bg-primary text-primary-foreground'
                : 'border border-border bg-background hover:bg-accent'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {isInBundle ? (
              <>
                <Check className="w-3 h-3" />
                Added
              </>
            ) : (
              <>
                <Plus className="w-3 h-3" />
                Add
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
