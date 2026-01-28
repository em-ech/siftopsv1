import { X, Trash2, Lock } from 'lucide-react';
import { SearchResult } from '@/types/siftops';
import { ScrollArea } from '@/components/ui/scroll-area';

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
    <div className={`fixed right-4 bottom-4 w-80 max-w-[calc(100vw-32px)] rounded-2xl p-3 shadow-lg z-50 animate-slide-up border-2 ${
      locked 
        ? 'bg-emerald-50 border-emerald-300' 
        : 'bg-background border-primary/30'
    }`}>
      {/* Header */}
      <div className="flex items-center gap-2.5">
        <div className={`w-2 h-2 rounded-full ${locked ? 'bg-emerald-500' : 'bg-primary animate-pulse'}`} />
        <h4 className="font-extrabold text-sm">Evidence Bundle</h4>
        <span className={`ml-auto text-xs px-2 py-0.5 rounded-full ${
          locked 
            ? 'bg-emerald-200 text-emerald-800' 
            : 'bg-primary/10 text-primary'
        }`}>
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

      {/* List with ScrollArea */}
      <div 
        className="mt-2.5"
        onWheel={(e) => e.stopPropagation()}
      >
        <ScrollArea className="h-48">
          <div className="flex flex-col gap-2 pr-3">
            {bundleItems.map(({ docId, title }) => (
              <div
                key={docId}
                className={`text-xs border rounded-lg p-2 flex items-start gap-2 ${
                  locked 
                    ? 'bg-white border-emerald-200 text-emerald-900' 
                    : 'bg-background border-border text-foreground'
                }`}
              >
                <span className="flex-1 line-clamp-2">{title}</span>
                {!locked && (
                  <button
                    onClick={() => onRemove(docId)}
                    className="p-1 rounded hover:bg-destructive/10 transition-colors flex-shrink-0"
                    aria-label="Remove from bundle"
                  >
                    <Trash2 className="w-3 h-3 text-muted-foreground hover:text-destructive" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Actions */}
      <div className="mt-2.5 flex gap-2.5">
        {!locked && (
          <>
            <button
              onClick={onClear}
              className="px-3 py-2 rounded-full text-xs font-medium border border-border bg-secondary hover:bg-destructive/10 hover:border-destructive/30 hover:text-destructive transition-colors"
            >
              Clear
            </button>
            <button
              onClick={onLock}
              className="px-3 py-2 rounded-full text-xs font-medium bg-emerald-600 text-white hover:bg-emerald-700 transition-colors flex items-center gap-1.5"
            >
              <Lock className="w-3 h-3" />
              Lock & Enable RAG
            </button>
          </>
        )}
        {locked && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-emerald-700 flex items-center gap-1.5">
              <Lock className="w-3 h-3" />
              Locked — RAG enabled
            </span>
            <button
              onClick={onClear}
              className="px-2 py-1 rounded text-xs text-muted-foreground hover:text-destructive transition-colors"
            >
              Unlock
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
