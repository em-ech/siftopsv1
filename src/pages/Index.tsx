import { useEffect, useState } from 'react';
import { LandingView } from '@/components/siftops/LandingView';
import { ResultsView } from '@/components/siftops/ResultsView';
import { useSiftOps } from '@/hooks/useSiftOps';

type ViewMode = 'landing' | 'results';

const Index = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('landing');
  const [currentQuery, setCurrentQuery] = useState('');

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
  } = useSiftOps();

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  const handleSearch = async (query: string) => {
    setCurrentQuery(query);
    setViewMode('results');
    await search(query);
  };

  const handleSync = async () => {
    await syncTechCrunch();
    // After sync, transition to results view
    setViewMode('results');
  };

  if (viewMode === 'landing') {
    return (
      <LandingView
        indexed={status.docs}
        isSyncing={isSyncing}
        onSearch={handleSearch}
        onSync={handleSync}
      />
    );
  }

  return (
    <ResultsView
      query={currentQuery}
      results={results}
      searchReason={searchReason}
      isSearching={isSearching}
      onSearch={handleSearch}
      isSyncing={isSyncing}
      onSync={handleSync}
      bundle={bundle}
      onCreateBundle={createBundle}
      onAddToBundle={addToBundle}
      onRemoveFromBundle={removeFromBundle}
      onLockBundle={lockBundle}
      onClearBundle={clearBundle}
      ragResponse={ragResponse}
      isAsking={isAsking}
      onAsk={askQuestion}
    />
  );
};

export default Index;
