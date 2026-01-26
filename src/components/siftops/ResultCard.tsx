import { ExternalLink, Plus, Check, ThumbsUp, ThumbsDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SearchResult } from '@/types/siftops';

interface ResultCardProps {
  result: SearchResult;
  isInBundle: boolean;
  bundleLocked: boolean;
  onAddToBundle: (docId: string) => void;
  onFeedback: (docId: string, helpful: boolean) => void;
}

export function ResultCard({
  result,
  isInBundle,
  bundleLocked,
  onAddToBundle,
  onFeedback,
}: ResultCardProps) {
  const scoreDisplay = (result.score * 100).toFixed(1);

  return (
    <div className="result-card animate-slide-up">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* Header row */}
          <div className="flex items-center gap-2 mb-2">
            <span className="type-badge uppercase">
              {result.type}
            </span>
            <span className="score-label">
              {scoreDisplay}%
            </span>
          </div>

          {/* Title */}
          <h3 className="font-medium text-foreground mb-1 leading-snug">
            {result.title}
          </h3>

          {/* URL */}
          <a
            href={result.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline mb-2 max-w-full truncate"
          >
            <ExternalLink className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">{result.url}</span>
          </a>

          {/* Snippet */}
          <p className="text-sm text-muted-foreground leading-relaxed">
            {result.snippet}
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-1.5 flex-shrink-0">
          <Button
            variant={isInBundle ? "default" : "outline"}
            size="sm"
            onClick={() => onAddToBundle(result.docId)}
            disabled={bundleLocked || isInBundle}
            className="gap-1 text-xs"
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
          </Button>
        </div>
      </div>

      {/* Feedback row */}
      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border">
        <span className="text-xs text-muted-foreground">Was this helpful?</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onFeedback(result.docId, true)}
          className="h-7 px-2 text-xs gap-1"
        >
          <ThumbsUp className="w-3 h-3" />
          Yes
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onFeedback(result.docId, false)}
          className="h-7 px-2 text-xs gap-1"
        >
          <ThumbsDown className="w-3 h-3" />
          No
        </Button>
      </div>
    </div>
  );
}
