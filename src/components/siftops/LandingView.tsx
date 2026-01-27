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
      <div className="w-full max-w-[720px] flex flex-col items-center gap-4">
        {/* Logo */}
        <h1 className="text-5xl font-extrabold tracking-tight text-foreground" style={{ letterSpacing: '-0.6px' }}>
          SiftOps
        </h1>

        {/* Search Input */}
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search TechCrunch"
          className="w-full px-4 py-3.5 border border-border rounded-full text-base bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-shadow"
        />

        {/* Actions */}
        <div className="flex gap-2.5 flex-wrap justify-center">
          <button
            onClick={handleSubmit}
            disabled={!query.trim()}
            className="px-4 py-2.5 bg-foreground text-background rounded-full text-sm font-medium border border-foreground hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Search className="w-4 h-4" />
            Search
          </button>
          <button
            onClick={onSync}
            disabled={isSyncing}
            className="px-4 py-2.5 bg-secondary text-secondary-foreground rounded-full text-sm font-medium border border-border hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Syncing...' : 'Sync TechCrunch'}
          </button>
        </div>

        {/* Status */}
        <p className="text-xs text-muted-foreground">
          {indexed > 0 ? `Indexed ${indexed} sources` : 'Not indexed'}
        </p>
      </div>
    </div>
  );
}
