import { useState, useEffect } from 'react';
import { ArrowLeft, Globe, RefreshCw, Check, Search, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Source {
  sourceId: string;
  name: string;
  baseUrl: string;
  status: 'not_indexed' | 'indexing' | 'indexed' | 'error';
  docs: number;
  chunks: number;
  lastSync: string | null;
  lastError: string | null;
}

interface WordPressSitesViewProps {
  sources: Source[];
  isSyncing: boolean;
  syncingSourceId: string | null;
  onBack: () => void;
  onSearch: (query: string) => void;
  onSync: (sourceId: string) => void;
  onRefresh: () => void;
}

export function WordPressSitesView({
  sources,
  isSyncing,
  syncingSourceId,
  onBack,
  onSearch,
  onSync,
  onRefresh,
}: WordPressSitesViewProps) {
  const [query, setQuery] = useState('');

  useEffect(() => {
    onRefresh();
  }, [onRefresh]);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (query.trim()) {
      onSearch(query);
    }
  };

  // Filter to only show Mozilla and TechCrunch
  const displaySources = sources.filter(s => 
    s.sourceId === 'mozilla' || s.sourceId === 'techcrunch'
  );

  const totalIndexed = displaySources.reduce((sum, s) => sum + (s.status === 'indexed' ? s.docs : 0), 0);
  const canSearch = totalIndexed > 0;

  const getStatusDisplay = (source: Source) => {
    if (syncingSourceId === source.sourceId) {
      return (
        <span className="flex items-center gap-1.5 text-sm text-primary">
          <Loader2 className="w-4 h-4 animate-spin" />
          Indexing...
        </span>
      );
    }
    
    switch (source.status) {
      case 'indexed':
        return (
          <span className="flex items-center gap-1.5 text-sm text-emerald-600">
            <Check className="w-4 h-4" />
            {source.docs} docs
          </span>
        );
      case 'indexing':
        return (
          <span className="flex items-center gap-1.5 text-sm text-primary">
            <Loader2 className="w-4 h-4 animate-spin" />
            Indexing...
          </span>
        );
      case 'error':
        return (
          <span className="flex items-center gap-1.5 text-sm text-destructive">
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

  const formatLastSync = (dateStr: string | null) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getThumbnailUrl = (baseUrl: string) => {
    return `https://s0.wp.com/mshots/v1/${encodeURIComponent(baseUrl)}?w=160&h=120`;
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
              <Globe className="w-4 h-4 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-bold text-foreground">WordPress Sites</h1>
              <p className="text-sm text-muted-foreground">
                Select sources to search
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
            placeholder={canSearch ? "Search across WordPress sources..." : "Index a source first to enable search..."}
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

        {/* Sites grid */}
        <div className="grid gap-4">
          {displaySources.map((source) => (
            <div
              key={source.sourceId}
              className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card hover:border-primary/50 transition-colors"
            >
              {/* Thumbnail */}
              <div className="w-20 h-15 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                <img
                  src={getThumbnailUrl(source.baseUrl)}
                  alt={source.name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </div>
              
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-foreground">{source.name}</h3>
                <p className="text-sm text-muted-foreground truncate">
                  {source.baseUrl}
                </p>
                {source.lastSync && source.status === 'indexed' && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Last synced: {formatLastSync(source.lastSync)}
                  </p>
                )}
                {source.lastError && source.status === 'error' && (
                  <p className="text-xs text-destructive mt-1 truncate">
                    {source.lastError}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-3">
                {getStatusDisplay(source)}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onSync(source.sourceId)}
                  disabled={isSyncing}
                  className="gap-1.5"
                >
                  {syncingSourceId === source.sourceId ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                  {source.status === 'indexed' ? 'Re-sync' : 'Sync'}
                </Button>
              </div>
            </div>
          ))}
        </div>

        {/* Status footer */}
        <p className="mt-6 text-center text-sm text-muted-foreground">
          {totalIndexed > 0
            ? `${totalIndexed} total documents indexed`
            : 'Click Sync on a source to start indexing'}
        </p>
      </div>
    </div>
  );
}
