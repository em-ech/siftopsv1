import { useState } from 'react';
import { ArrowLeft, Globe, RefreshCw, Check, Search, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface WordPressSite {
  id: string;
  name: string;
  url: string;
  indexed: boolean;
  docsCount: number;
  status: 'not_indexed' | 'indexing' | 'indexed' | 'error';
  lastSync?: string | null;
  lastError?: string | null;
}

interface WordPressSitesViewProps {
  indexed: number;
  isSyncing: boolean;
  status?: string;
  lastSync?: string | null;
  lastError?: string | null;
  onBack: () => void;
  onSearch: (query: string) => void;
  onSync: () => void;
}

export function WordPressSitesView({
  indexed,
  isSyncing,
  status = 'idle',
  lastSync,
  lastError,
  onBack,
  onSearch,
  onSync,
}: WordPressSitesViewProps) {
  const [query, setQuery] = useState('');
  
  // Determine the current status
  const getDisplayStatus = (): 'not_indexed' | 'indexing' | 'indexed' | 'error' => {
    if (isSyncing || status === 'syncing') return 'indexing';
    if (status === 'error') return 'error';
    if (indexed > 0 || status === 'complete') return 'indexed';
    return 'not_indexed';
  };

  const displayStatus = getDisplayStatus();

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (query.trim()) {
      onSearch(query);
    }
  };

  const canSearch = indexed > 0 && displayStatus === 'indexed';

  // Get mShots thumbnail URL
  const thumbnailUrl = `https://s0.wp.com/mshots/v1/https%3A%2F%2Fblog.mozilla.org?w=400&h=240`;

  const getStatusBadge = () => {
    switch (displayStatus) {
      case 'indexed':
        return (
          <span className="flex items-center gap-1.5 text-sm text-emerald-600 font-medium">
            <Check className="w-4 h-4" />
            Indexed • {indexed} docs
          </span>
        );
      case 'indexing':
        return (
          <span className="flex items-center gap-1.5 text-sm text-primary font-medium">
            <Loader2 className="w-4 h-4 animate-spin" />
            Indexing...
          </span>
        );
      case 'error':
        return (
          <span className="flex items-center gap-1.5 text-sm text-destructive font-medium">
            <AlertCircle className="w-4 h-4" />
            Error
          </span>
        );
      default:
        return (
          <span className="text-sm text-muted-foreground">
            Not indexed
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 -ml-2 rounded-lg hover:bg-accent transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Search className="w-4 h-4 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-bold text-foreground">SiftOps</h1>
              <p className="text-sm text-muted-foreground">
                Mozilla Blog Indexing
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Search bar */}
        <form onSubmit={handleSubmit} className="flex gap-2 mb-6">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={canSearch ? "Search Mozilla Blog..." : "Index Mozilla Blog first to enable search..."}
            disabled={!canSearch}
            className="flex-1 px-4 py-3 border border-border rounded-lg text-sm bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <button
            type="submit"
            disabled={!query.trim() || !canSearch}
            className="px-5 py-3 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Search className="w-4 h-4" />
            Sift
          </button>
        </form>

        {/* Mozilla Blog card with thumbnail */}
        <div className="rounded-xl border border-border bg-card overflow-hidden hover:border-primary/50 transition-colors">
          {/* Thumbnail */}
          <div className="w-full h-40 bg-muted overflow-hidden">
            <img
              src={thumbnailUrl}
              alt="Mozilla Blog preview"
              className="w-full h-full object-cover object-top"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>
          
          {/* Card content */}
          <div className="p-4">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Globe className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-foreground">Mozilla Blog</h3>
                <p className="text-sm text-muted-foreground truncate">
                  https://blog.mozilla.org
                </p>
              </div>
              <div className="flex items-center">
                {getStatusBadge()}
              </div>
            </div>

            {/* Last sync info */}
            {lastSync && displayStatus === 'indexed' && (
              <p className="mt-3 text-xs text-muted-foreground">
                Last synced: {new Date(lastSync).toLocaleString()}
              </p>
            )}

            {/* Error message */}
            {lastError && displayStatus === 'error' && (
              <p className="mt-3 text-xs text-destructive">
                Error: {lastError}
              </p>
            )}
          </div>
        </div>

        {/* Sync button at bottom */}
        <div className="mt-6 flex justify-center">
          <Button
            onClick={onSync}
            disabled={isSyncing || displayStatus === 'indexing'}
            size="lg"
            className="gap-2 px-8"
          >
            {isSyncing || displayStatus === 'indexing' ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <RefreshCw className="w-5 h-5" />
            )}
            {isSyncing || displayStatus === 'indexing' 
              ? 'Indexing...' 
              : indexed > 0 
                ? 'Re-sync' 
                : 'Start Indexing'}
          </Button>
        </div>

        {/* Status footer */}
        <p className="mt-6 text-center text-sm text-muted-foreground">
          {displayStatus === 'indexing' 
            ? 'Fetching posts and generating embeddings with local Ollama...'
            : indexed > 0
              ? `${indexed} documents indexed • Ready to search`
              : 'Click "Start Indexing" to sync Mozilla Blog with local Ollama'}
        </p>

        {/* Technical note */}
        <div className="mt-8 p-4 rounded-lg bg-muted/50 border border-border">
          <h4 className="text-sm font-medium text-foreground mb-2">Requirements</h4>
          <ul className="text-xs text-muted-foreground space-y-1">
            <li>• Ollama running at localhost:11434</li>
            <li>• Models: nomic-embed-text, llama3.1:8b</li>
            <li>• Backend: node server.js on port 8080</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
