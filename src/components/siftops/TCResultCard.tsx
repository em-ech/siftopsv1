import { Plus, Check } from 'lucide-react';
import { SearchResult } from '@/types/siftops';

interface TCResultCardProps {
  result: SearchResult;
  isInBundle: boolean;
  bundleLocked: boolean;
  onAddToBundle: (docId: string) => void;
}

export function TCResultCard({
  result,
  isInBundle,
  bundleLocked,
  onAddToBundle,
}: TCResultCardProps) {
  // Format meta line (placeholder for author/date)
  const meta = result.type === 'post' ? 'TechCrunch Staff' : 'Page';

  return (
    <div className="border-t border-border pt-3.5 animate-slide-up">
      {/* Category tag */}
      <span className="inline-block px-2.5 py-1 bg-secondary border border-border rounded-full text-xs uppercase tracking-wider text-foreground">
        {result.type}
      </span>

      {/* Title */}
      <h3 className="mt-2 text-xl font-extrabold leading-tight">
        <a
          href={result.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-foreground hover:underline"
        >
          {result.title}
        </a>
      </h3>

      {/* Meta line */}
      <p className="mt-1.5 text-sm text-muted-foreground">
        {meta}
      </p>

      {/* URL */}
      <p className="mt-1.5 text-sm">
        <a
          href={result.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline break-all"
        >
          {result.url}
        </a>
      </p>

      {/* Snippet */}
      <p className="mt-2.5 text-sm text-foreground/80 leading-relaxed">
        {result.snippet}
      </p>

      {/* Actions */}
      <div className="mt-2.5 flex gap-2.5 flex-wrap">
        <button
          onClick={() => onAddToBundle(result.docId)}
          disabled={bundleLocked || isInBundle}
          className="px-3 py-2 rounded-full text-xs font-medium border border-border bg-secondary hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
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
  );
}
