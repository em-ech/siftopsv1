import { ExternalLink, FileText, Plus, Check, Globe, HardDrive, Cloud } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SearchResult as SearchResultType } from '@/types/search';
import { cn } from '@/lib/utils';

interface SearchResultProps {
  result: SearchResultType;
  isInBundle: boolean;
  bundleLocked: boolean;
  onAddToBundle: (docId: string) => void;
  index: number;
}

function getSourceIcon(location: string) {
  if (location.includes('drive.google.com')) return <Cloud className="w-4 h-4" />;
  if (location.includes('onedrive.com')) return <Cloud className="w-4 h-4" />;
  if (location.startsWith('file://')) return <HardDrive className="w-4 h-4" />;
  return <Globe className="w-4 h-4" />;
}

function getSourceLabel(docId: string) {
  if (docId.startsWith('wp_')) return 'WordPress';
  if (docId.startsWith('gd_')) return 'Google Drive';
  if (docId.startsWith('od_')) return 'OneDrive';
  if (docId.startsWith('lf_')) return 'Local';
  return 'Unknown';
}

export function SearchResultCard({ result, isInBundle, bundleLocked, onAddToBundle, index }: SearchResultProps) {
  const scorePercent = Math.round(result.score * 100);

  return (
    <div
      className={cn(
        "group glass-panel rounded-xl p-5 transition-all duration-300 animate-slide-up",
        isInBundle && "border-primary/50 bg-primary/5"
      )}
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className="security-badge bg-secondary text-secondary-foreground">
              {getSourceIcon(result.location)}
              {getSourceLabel(result.doc_id)}
            </span>
            <span className="security-badge bg-primary/10 text-primary">
              {scorePercent}% match
            </span>
          </div>

          <h3 className="text-lg font-medium text-foreground mb-1 truncate group-hover:text-primary transition-colors">
            {result.title}
          </h3>

          <a
            href={result.location}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors mb-3 truncate max-w-full"
          >
            <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate">{result.location}</span>
          </a>

          <p className="text-sm text-muted-foreground leading-relaxed">
            {result.snippet}
          </p>

          <div className="mt-3 flex items-center gap-2">
            <div className="flex-1 h-1 rounded-full bg-secondary overflow-hidden">
              <div
                className="score-bar transition-all duration-500"
                style={{ width: `${scorePercent}%` }}
              />
            </div>
          </div>
        </div>

        <div className="flex-shrink-0">
          <Button
            variant={isInBundle ? "success" : "outline"}
            size="sm"
            onClick={() => onAddToBundle(result.doc_id)}
            disabled={bundleLocked || isInBundle}
            className="gap-1.5"
          >
            {isInBundle ? (
              <>
                <Check className="w-4 h-4" />
                Added
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                Add
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
