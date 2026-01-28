import { useState } from 'react';
import { Search, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SearchSectionProps {
  onSearch: (query: string) => void;
  isSearching: boolean;
}

export function SearchSection({ onSearch, isSearching }: SearchSectionProps) {
  const [query, setQuery] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(query);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search TechCrunch content..."
            className="w-full h-12 pl-4 pr-4 bg-background border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-shadow"
          />
        </div>
        <Button
          type="submit"
          disabled={isSearching || !query.trim()}
          className="h-12 px-6 gap-2"
        >
          {isSearching ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Search className="w-4 h-4" />
          )}
          Sift
        </Button>
      </div>
      
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="px-2 py-0.5 bg-secondary rounded text-secondary-foreground font-medium">
          Semantic
        </span>
        <span>Vector similarity search enabled</span>
      </div>
    </form>
  );
}
