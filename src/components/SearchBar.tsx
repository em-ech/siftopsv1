import { useState, useEffect, useRef } from 'react';
import { Search, Loader2, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SearchBarProps {
  onSearch: (query: string) => void;
  isSearching: boolean;
}

export function SearchBar({ onSearch, isSearching }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const debounce = setTimeout(() => {
      onSearch(query);
    }, 300);

    return () => clearTimeout(debounce);
  }, [query, onSearch]);

  return (
    <div className="relative max-w-3xl mx-auto">
      <div
        className={cn(
          "relative rounded-2xl transition-all duration-300",
          isFocused && "search-glow"
        )}
      >
        <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
          {isSearching ? (
            <Loader2 className="w-5 h-5 text-primary animate-spin" />
          ) : (
            <Search className="w-5 h-5 text-muted-foreground" />
          )}
        </div>
        
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder="Search by meaning across all connected sources..."
          className="w-full h-14 pl-14 pr-32 bg-secondary/50 border border-border rounded-2xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors"
        />

        <div className="absolute inset-y-0 right-0 pr-4 flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted text-xs text-muted-foreground">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <span>Semantic</span>
          </div>
        </div>
      </div>

      {!query && (
        <p className="text-center text-sm text-muted-foreground mt-4">
          Search returns real links — no hallucinations, no data leakage
        </p>
      )}
    </div>
  );
}
