import { Header } from '@/components/Header';
import { SearchBar } from '@/components/SearchBar';
import { SearchResultCard } from '@/components/SearchResult';
import { BundlePanel } from '@/components/BundlePanel';
import { RAGPanel } from '@/components/RAGPanel';
import { SecurityBadges } from '@/components/SecurityBadges';
import { useSearch } from '@/hooks/useSearch';
import { Search } from 'lucide-react';

const Index = () => {
  const {
    results,
    isSearching,
    search,
    bundle,
    createBundle,
    addToBundle,
    removeFromBundle,
    lockBundle,
    unlockBundle,
    ragResponse,
    askRAG,
    isGenerating,
  } = useSearch();

  return (
    <div className="min-h-screen bg-background">
      {/* Background Pattern */}
      <div className="fixed inset-0 bg-grid-pattern bg-grid opacity-[0.02] pointer-events-none" />
      <div className="fixed inset-0 bg-gradient-radial from-primary/5 via-transparent to-transparent pointer-events-none" />

      <Header />

      <main className="relative max-w-7xl mx-auto px-6 py-12">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            <span className="text-gradient">Secure Enterprise Search</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
            Find internal documents by meaning. Permission-filtered results. 
            AI answers only from sources you explicitly lock.
          </p>
          <SecurityBadges />
        </div>

        {/* Search Bar */}
        <div className="mb-12">
          <SearchBar onSearch={search} isSearching={isSearching} />
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Results Column */}
          <div className="lg:col-span-2 space-y-4">
            {results.length > 0 ? (
              <>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">
                    {results.length} result{results.length !== 1 ? 's' : ''} found
                  </span>
                </div>
                {results.map((result, index) => (
                  <SearchResultCard
                    key={result.doc_id}
                    result={result}
                    isInBundle={bundle?.docs.includes(result.doc_id) ?? false}
                    bundleLocked={bundle?.locked ?? false}
                    onAddToBundle={addToBundle}
                    index={index}
                  />
                ))}
              </>
            ) : (
              <div className="glass-panel rounded-xl p-12 text-center">
                <div className="w-16 h-16 rounded-2xl bg-secondary mx-auto mb-4 flex items-center justify-center">
                  <Search className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium mb-2">Start Searching</h3>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  Type a query to search across WordPress, Google Drive, OneDrive, and local files. 
                  Results are filtered by your permissions before display.
                </p>
              </div>
            )}

            {/* RAG Panel */}
            {(bundle?.locked || results.length > 0) && (
              <div className="mt-8">
                <RAGPanel
                  isLocked={bundle?.locked ?? false}
                  ragResponse={ragResponse}
                  isGenerating={isGenerating}
                  onAsk={askRAG}
                />
              </div>
            )}
          </div>

          {/* Bundle Sidebar */}
          <div className="lg:col-span-1">
            <BundlePanel
              bundle={bundle}
              results={results}
              onCreateBundle={createBundle}
              onRemoveFromBundle={removeFromBundle}
              onLockBundle={lockBundle}
              onUnlockBundle={unlockBundle}
            />
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;
