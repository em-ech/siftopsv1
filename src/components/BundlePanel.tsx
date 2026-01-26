import { Lock, Unlock, FileText, X, ShieldCheck, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Bundle, SearchResult } from '@/types/search';
import { cn } from '@/lib/utils';

interface BundlePanelProps {
  bundle: Bundle | null;
  results: SearchResult[];
  onCreateBundle: () => void;
  onRemoveFromBundle: (docId: string) => void;
  onLockBundle: () => void;
  onUnlockBundle: () => void;
}

export function BundlePanel({
  bundle,
  results,
  onCreateBundle,
  onRemoveFromBundle,
  onLockBundle,
  onUnlockBundle,
}: BundlePanelProps) {
  const bundledDocs = results.filter(r => bundle?.docs.includes(r.doc_id));

  return (
    <div className="glass-panel rounded-xl p-5 h-fit sticky top-24">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className={cn(
            "w-8 h-8 rounded-lg flex items-center justify-center",
            bundle?.locked ? "bg-accent/20" : "bg-secondary"
          )}>
            {bundle?.locked ? (
              <Lock className="w-4 h-4 text-accent" />
            ) : (
              <Unlock className="w-4 h-4 text-muted-foreground" />
            )}
          </div>
          <div>
            <h3 className="font-medium">Evidence Bundle</h3>
            <p className="text-xs text-muted-foreground">
              {bundle ? (bundle.locked ? 'Locked for RAG' : 'Collecting sources') : 'No active bundle'}
            </p>
          </div>
        </div>
      </div>

      {!bundle ? (
        <div className="text-center py-8">
          <div className="w-12 h-12 rounded-xl bg-secondary mx-auto mb-3 flex items-center justify-center">
            <FileText className="w-6 h-6 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Create a bundle to collect sources for AI-assisted answers
          </p>
          <Button onClick={onCreateBundle} variant="outline" className="w-full">
            Create Bundle
          </Button>
        </div>
      ) : (
        <>
          <div className="space-y-2 mb-4 max-h-64 overflow-y-auto">
            {bundledDocs.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-sm text-muted-foreground">
                  Add documents from search results
                </p>
              </div>
            ) : (
              bundledDocs.map((doc) => (
                <div
                  key={doc.doc_id}
                  className="flex items-center gap-2 p-2 rounded-lg bg-secondary/50 group"
                >
                  <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <span className="text-sm truncate flex-1">{doc.title}</span>
                  {!bundle.locked && (
                    <button
                      onClick={() => onRemoveFromBundle(doc.doc_id)}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-destructive/20 rounded transition-all"
                    >
                      <X className="w-3.5 h-3.5 text-destructive" />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>

          <div className="border-t border-border pt-4 space-y-3">
            {bundle.locked ? (
              <>
                <div className="flex items-center gap-2 p-3 rounded-lg bg-success/10 border border-success/20">
                  <ShieldCheck className="w-4 h-4 text-success" />
                  <span className="text-sm text-success">Sources verified & locked</span>
                </div>
                <Button onClick={onUnlockBundle} variant="outline" className="w-full">
                  Clear Bundle
                </Button>
              </>
            ) : (
              <>
                {bundledDocs.length > 0 && (
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-accent/10 border border-accent/20">
                    <AlertTriangle className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
                    <span className="text-xs text-accent">
                      Lock the bundle to enable AI-assisted answers. RAG only uses these exact sources.
                    </span>
                  </div>
                )}
                <Button
                  onClick={onLockBundle}
                  variant="accent"
                  className="w-full"
                  disabled={bundledDocs.length === 0}
                >
                  <Lock className="w-4 h-4" />
                  Lock Bundle ({bundledDocs.length})
                </Button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
