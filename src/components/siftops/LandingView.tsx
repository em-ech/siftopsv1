import { useState } from 'react';
import { Search, RefreshCw } from 'lucide-react';

interface LandingViewProps {
  indexed: number;
  isSyncing: boolean;
  onSearch: (query: string) => void;
  onSync: () => void;
}

export function LandingView({ indexed, isSyncing, onSearch, onSync }: LandingViewProps) {
  const [query, setQuery] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      onSearch(query);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit(e);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="w-full max-w-[720px] flex flex-col items-center gap-5">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
            <Search className="w-5 h-5 text-primary-foreground" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-foreground">
            SiftOps
          </h1>
        </div>

        {/* Tagline */}
        <p className="text-muted-foreground text-center">
          Semantic search with evidence-based RAG
        </p>

        {/* Search Input */}
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search sources..."
          className="w-full px-5 py-3.5 border border-border rounded-lg text-base bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
        />

        {/* Actions */}
        <div className="flex gap-3 flex-wrap justify-center">
          <button
            onClick={handleSubmit}
            disabled={!query.trim()}
            className="px-5 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Search className="w-4 h-4" />
            Search
          </button>
          <button
            onClick={onSync}
            disabled={isSyncing}
            className="px-5 py-2.5 bg-background text-foreground rounded-lg text-sm font-medium border border-border hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Syncing...' : 'Sync'}
          </button>
        </div>

        {/* Status */}
        <p className="text-xs text-muted-foreground">
          {indexed > 0 ? `${indexed} sources indexed` : 'No sources indexed yet'}
        </p>
      </div>
    </div>
  );
}
