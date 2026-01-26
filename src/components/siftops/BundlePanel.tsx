import { Lock, Unlock, Trash2, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Bundle, SearchResult } from '@/types/siftops';

interface BundlePanelProps {
  bundle: Bundle | null;
  results: SearchResult[];
  onCreate: () => void;
  onRemove: (docId: string) => void;
  onLock: () => void;
  onClear: () => void;
}

export function BundlePanel({
  bundle,
  results,
  onCreate,
  onRemove,
  onLock,
  onClear,
}: BundlePanelProps) {
  const getDocTitle = (docId: string) => {
    const result = results.find(r => r.docId === docId);
    return result?.title || docId;
  };

  const getDocUrl = (docId: string) => {
    const result = results.find(r => r.docId === docId);
    return result?.url || '#';
  };

  return (
    <div className="border border-border rounded-lg p-4 bg-card">
      <h2 className="text-sm font-medium text-foreground mb-3">Evidence Bundle</h2>

      {!bundle ? (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            No active bundle. Create one to collect sources.
          </p>
          <Button onClick={onCreate} variant="outline" size="sm" className="w-full gap-1.5">
            <Plus className="w-3.5 h-3.5" />
            Create Bundle
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Status */}
          <div className="flex items-center gap-2 text-xs">
            <span className={`px-2 py-0.5 rounded ${bundle.locked ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'}`}>
              {bundle.locked ? 'Locked' : 'Unlocked'}
            </span>
            <span className="text-muted-foreground">
              {bundle.docIds.length} source{bundle.docIds.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onLock}
              disabled={bundle.locked || bundle.docIds.length === 0}
              className="flex-1 gap-1"
            >
              <Lock className="w-3 h-3" />
              Lock
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onClear}
              className="flex-1 gap-1"
            >
              <Trash2 className="w-3 h-3" />
              Clear
            </Button>
          </div>

          {/* Sources list */}
          {bundle.docIds.length > 0 ? (
            <div className="space-y-1.5 max-h-60 overflow-y-auto">
              {bundle.docIds.map((docId) => (
                <div
                  key={docId}
                  className="flex items-center gap-2 p-2 rounded bg-secondary text-xs"
                >
                  <a
                    href={getDocUrl(docId)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 text-foreground hover:text-primary truncate"
                  >
                    {getDocTitle(docId)}
                  </a>
                  {!bundle.locked && (
                    <button
                      onClick={() => onRemove(docId)}
                      className="text-muted-foreground hover:text-destructive p-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground py-2">
              Add sources from search results.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
