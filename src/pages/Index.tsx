import { useEffect, useState } from 'react';
import { LandingView } from '@/components/siftops/LandingView';
import { WordPressSitesView } from '@/components/siftops/WordPressSitesView';
import { ResultsView } from '@/components/siftops/ResultsView';
import { useSiftOps } from '@/hooks/useSiftOps';

type ViewMode = 'landing' | 'wordpress' | 'results';

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

  const handleSelectSourceType = (type: 'wordpress' | 'local' | 'onedrive' | 'gdrive') => {
    if (type === 'wordpress') {
      setViewMode('wordpress');
    }
    // Other source types coming soon
  };

  const handleSearch = async (query: string) => {
    setCurrentQuery(query);
    setViewMode('results');
    await search(query);
  };

  const handleSync = async () => {
    await syncTechCrunch();
  };

  if (viewMode === 'landing') {
    return (
      <LandingView
        onSelectSourceType={handleSelectSourceType}
      />
    );
  }

  if (viewMode === 'wordpress') {
    return (
      <WordPressSitesView
        indexed={status.docs}
        isSyncing={isSyncing}
        onBack={() => setViewMode('landing')}
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
      onGoHome={() => setViewMode('landing')}
    />
  );
};

export default Index;
