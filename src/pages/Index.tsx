import { useEffect } from 'react';
import { TopBar } from '@/components/siftops/TopBar';
import { SearchSection } from '@/components/siftops/SearchSection';
import { ResultsList } from '@/components/siftops/ResultsList';
import { BundlePanel } from '@/components/siftops/BundlePanel';
import { AskPanel } from '@/components/siftops/AskPanel';
import { useSiftOps } from '@/hooks/useSiftOps';

const Index = () => {
  const {
    status,
    isSyncing,
    refreshStatus,
    syncTechCrunch,
    results,
    isSearching,
    searchReason,
    search,
    bundle,
    createBundle,
    addToBundle,
    removeFromBundle,
    lockBundle,
    clearBundle,
    ragResponse,
    isAsking,
    askQuestion,
    submitFeedback,
  } = useSiftOps();

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  return (
    <div className="min-h-screen bg-background">
      <TopBar
        status={status}
        isSyncing={isSyncing}
        onSync={syncTechCrunch}
      />

      <main className="max-w-[960px] mx-auto px-4 py-6">
        {/* Search */}
        <div className="mb-8">
          <SearchSection onSearch={search} isSearching={isSearching} />
        </div>

        {/* Main grid */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
          {/* Results column */}
          <div className="space-y-6">
            <ResultsList
              results={results}
              searchReason={searchReason}
              bundleDocIds={bundle?.docIds || []}
              bundleLocked={bundle?.locked || false}
              onAddToBundle={addToBundle}
              onFeedback={submitFeedback}
            />

            {/* RAG section */}
            {(bundle?.locked || results.length > 0) && (
              <AskPanel
                isLocked={bundle?.locked || false}
                ragResponse={ragResponse}
                isAsking={isAsking}
                onAsk={askQuestion}
              />
            )}
          </div>

          {/* Bundle sidebar */}
          <div className="lg:sticky lg:top-20 h-fit">
            <BundlePanel
              bundle={bundle}
              results={results}
              onCreate={createBundle}
              onRemove={removeFromBundle}
              onLock={lockBundle}
              onClear={clearBundle}
            />
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;
