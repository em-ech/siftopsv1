import { Search } from 'lucide-react';
import { SearchResult } from '@/types/siftops';
import { ResultCard } from './ResultCard';

interface ResultsListProps {
  results: SearchResult[];
  searchReason: string | null;
  bundleDocIds: string[];
  bundleLocked: boolean;
  onAddToBundle: (docId: string) => void;
  onFeedback: (docId: string, helpful: boolean) => void;
}

export function ResultsList({
  results,
  searchReason,
  bundleDocIds,
  bundleLocked,
  onAddToBundle,
  onFeedback,
}: ResultsListProps) {
  if (searchReason === 'not_indexed') {
    return (
      <div className="text-center py-12">
        <div className="w-12 h-12 rounded-lg bg-secondary mx-auto mb-3 flex items-center justify-center">
          <Search className="w-5 h-5 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground">
          No content indexed yet. Click "Sync TechCrunch" to start.
        </p>
      </div>
    );
  }

  if (searchReason === 'no_matches' || searchReason === 'low_confidence') {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-muted-foreground">
          No matching sources found in your indexed documents.
        </p>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-12 h-12 rounded-lg bg-secondary mx-auto mb-3 flex items-center justify-center">
          <Search className="w-5 h-5 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground">
          Enter a query to search TechCrunch content.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-foreground">Results</h2>
        <span className="text-xs text-muted-foreground">
          {results.length} source{results.length !== 1 ? 's' : ''} found
        </span>
      </div>

      <div className="space-y-2">
        {results.map((result) => (
          <ResultCard
            key={result.docId}
            result={result}
            isInBundle={bundleDocIds.includes(result.docId)}
            bundleLocked={bundleLocked}
            onAddToBundle={onAddToBundle}
            onFeedback={onFeedback}
          />
        ))}
      </div>
    </div>
  );
}
