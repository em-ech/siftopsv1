import { X, Trash2, Lock } from 'lucide-react';
import { SearchResult } from '@/types/siftops';

interface BundleDrawerProps {
  bundleDocIds: string[];
  results: SearchResult[];
  locked: boolean;
  onRemove: (docId: string) => void;
  onClear: () => void;
  onLock: () => void;
  onClose: () => void;
}

export function BundleDrawer({
  bundleDocIds,
  results,
  locked,
  onRemove,
  onClear,
  onLock,
  onClose,
}: BundleDrawerProps) {
  if (bundleDocIds.length === 0) return null;

  // Get titles for bundle items
  const bundleItems = bundleDocIds.map((docId) => {
    const result = results.find((r) => r.docId === docId);
    return { docId, title: result?.title || docId };
  });

  return (
    <div className="fixed right-4 bottom-4 w-80 max-w-[calc(100vw-32px)] bg-background border border-border rounded-2xl p-3 shadow-lg z-50 animate-slide-up">
      {/* Header */}
      <div className="flex items-center gap-2.5">
        <h4 className="font-extrabold text-sm">Evidence Bundle</h4>
        <span className="ml-auto text-xs text-muted-foreground">
          {bundleDocIds.length} source{bundleDocIds.length !== 1 ? 's' : ''}
        </span>
        <button
          onClick={onClose}
          className="p-1.5 rounded-full hover:bg-secondary transition-colors"
          aria-label="Close drawer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* List */}
      <div className="mt-2.5 flex flex-col gap-2 max-h-56 overflow-auto">
        {bundleItems.map(({ docId, title }) => (
          <div
            key={docId}
            className="text-xs text-foreground border border-border rounded-lg p-2 flex items-start gap-2"
          >
            <span className="flex-1 line-clamp-2">{title}</span>
            {!locked && (
              <button
                onClick={() => onRemove(docId)}
                className="p-1 rounded hover:bg-secondary transition-colors flex-shrink-0"
                aria-label="Remove from bundle"
              >
                <Trash2 className="w-3 h-3 text-muted-foreground" />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="mt-2.5 flex gap-2.5">
        {!locked && (
          <>
            <button
              onClick={onClear}
              className="px-3 py-2 rounded-full text-xs font-medium border border-border bg-secondary hover:bg-accent transition-colors"
            >
              Clear
            </button>
            <button
              onClick={onLock}
              className="px-3 py-2 rounded-full text-xs font-medium border border-border bg-foreground text-background hover:opacity-90 transition-opacity flex items-center gap-1.5"
            >
              <Lock className="w-3 h-3" />
              Lock Bundle
            </button>
          </>
        )}
        {locked && (
          <span className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Lock className="w-3 h-3" />
            Bundle locked for RAG
          </span>
        )}
      </div>
    </div>
  );
}
