import { Search, Globe, HardDrive, Cloud } from 'lucide-react';
import { SourceTypeCard } from './SourceTypeCard';

interface LandingViewProps {
  onSelectSourceType: (type: 'wordpress' | 'local' | 'onedrive' | 'gdrive') => void;
}

export function LandingView({ onSelectSourceType }: LandingViewProps) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="w-full max-w-3xl flex flex-col items-center gap-8">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center">
            <Search className="w-6 h-6 text-primary-foreground" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-foreground">
            SiftOps
          </h1>
        </div>

        {/* Tagline */}
        <p className="text-muted-foreground text-center text-lg">
          Semantic search with evidence-based RAG
        </p>

        {/* Source type cards */}
        <div className="grid grid-cols-2 gap-4 w-full max-w-2xl">
          <SourceTypeCard
            icon={Globe}
            title="WordPress"
            description="Search WordPress sites like TechCrunch, Mozilla Blog"
            enabled={true}
            onClick={() => onSelectSourceType('wordpress')}
          />
          <SourceTypeCard
            icon={HardDrive}
            title="Local Harddrive"
            description="Index and search local files"
            enabled={false}
            onClick={() => {}}
          />
          <SourceTypeCard
            icon={Cloud}
            title="OneDrive"
            description="Connect your Microsoft OneDrive"
            enabled={false}
            onClick={() => {}}
          />
          <SourceTypeCard
            icon={Cloud}
            title="Google Drive"
            description="Connect your Google Drive"
            enabled={false}
            onClick={() => {}}
          />
        </div>

        {/* Footer */}
        <p className="text-xs text-muted-foreground">
          Select a source type to get started
        </p>
      </div>
    </div>
  );
}
