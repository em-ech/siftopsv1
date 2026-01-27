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
  return (
    <div className="border-t border-border pt-3.5 animate-slide-up">
      {/* Title */}
      <h3 className="text-lg font-bold leading-tight">
        <a
          href={result.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-foreground hover:underline"
        >
          {result.title}
        </a>
      </h3>

      {/* Meta line - author + type tag */}
      <p className="mt-1.5 text-sm text-muted-foreground flex items-center gap-2">
        <span>TechCrunch Staff</span>
        <span className="inline-block px-2 py-0.5 bg-secondary border border-border rounded-full text-xs uppercase tracking-wider text-foreground">
          {result.type}
        </span>
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
          className={`px-3 py-2 rounded-full text-xs font-medium border transition-colors flex items-center gap-1.5 ${
            isInBundle 
              ? 'border-emerald-300 bg-emerald-50 text-emerald-700 cursor-default' 
              : 'border-border bg-secondary hover:bg-primary hover:text-primary-foreground hover:border-primary disabled:opacity-50 disabled:cursor-not-allowed'
          }`}
        >
          {isInBundle ? (
            <>
              <Check className="w-3 h-3" />
              Added
            </>
          ) : (
            <>
              <Plus className="w-3 h-3" />
              Add to Bundle
            </>
          )}
        </button>
      </div>
    </div>
  );
}
