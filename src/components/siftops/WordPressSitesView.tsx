import { useState } from 'react';
import { ArrowLeft, Globe, RefreshCw, Check, Search } from 'lucide-react';

interface WordPressSite {
  id: string;
  name: string;
  url: string;
  indexed: boolean;
  docsCount: number;
}

const DEFAULT_SITES: WordPressSite[] = [
  { id: 'techcrunch', name: 'TechCrunch', url: 'https://techcrunch.com', indexed: true, docsCount: 0 },
  { id: 'mozilla', name: 'Mozilla Blog', url: 'https://blog.mozilla.org', indexed: false, docsCount: 0 },
  { id: 'wpnews', name: 'WordPress.org News', url: 'https://wordpress.org/news', indexed: false, docsCount: 0 },
  { id: 'smashing', name: 'Smashing Magazine', url: 'https://www.smashingmagazine.com', indexed: false, docsCount: 0 },
  { id: 'nasa', name: 'NASA Blogs', url: 'https://blogs.nasa.gov', indexed: false, docsCount: 0 },
];

interface WordPressSitesViewProps {
  indexed: number;
  isSyncing: boolean;
  onBack: () => void;
  onSearch: (query: string) => void;
  onSync: () => void;
}

export function WordPressSitesView({
  indexed,
  isSyncing,
  onBack,
  onSearch,
  onSync,
}: WordPressSitesViewProps) {
  const [query, setQuery] = useState('');
  const [sites] = useState<WordPressSite[]>(
    DEFAULT_SITES.map((site) => ({
      ...site,
      indexed: site.id === 'techcrunch' && indexed > 0,
      docsCount: site.id === 'techcrunch' ? indexed : 0,
    }))
  );

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (query.trim()) {
      onSearch(query);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 -ml-2 rounded-lg hover:bg-accent transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Globe className="w-4 h-4 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-bold text-foreground">WordPress Sites</h1>
              <p className="text-sm text-muted-foreground">
                Select sources to search
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Search bar */}
        <form onSubmit={handleSubmit} className="flex gap-2 mb-6">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search across WordPress sources..."
            className="flex-1 px-4 py-3 border border-border rounded-lg text-sm bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
          />
          <button
            type="submit"
            disabled={!query.trim()}
            className="px-5 py-3 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Search className="w-4 h-4" />
            Sift
          </button>
        </form>

        {/* Sites grid */}
        <div className="grid gap-3">
          {sites.map((site) => (
            <div
              key={site.id}
              className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card hover:border-primary/50 transition-colors"
            >
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Globe className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-foreground">{site.name}</h3>
                <p className="text-sm text-muted-foreground truncate">
                  {site.url}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {site.indexed ? (
                  <span className="flex items-center gap-1.5 text-sm text-emerald-600">
                    <Check className="w-4 h-4" />
                    {site.docsCount} docs
                  </span>
                ) : (
                  <span className="text-sm text-muted-foreground">
                    Not indexed
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Status footer */}
        <p className="mt-6 text-center text-sm text-muted-foreground">
          {indexed > 0
            ? `${indexed} total documents indexed`
            : 'Click Sync to start indexing sources'}
        </p>
      </div>
    </div>
  );
}
