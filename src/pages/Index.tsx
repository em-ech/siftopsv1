import { useEffect, useState } from 'react';
import { LandingView } from '@/components/siftops/LandingView';
import { WordPressSitesView } from '@/components/siftops/WordPressSitesView';
import { ResultsView } from '@/components/siftops/ResultsView';
import { GoogleDriveView } from '@/components/siftops/GoogleDriveView';
import { GDriveResultsView } from '@/components/siftops/GDriveResultsView';
import { useLocalSiftOps } from '@/hooks/useLocalSiftOps';
import { useGoogleDrive } from '@/hooks/useGoogleDrive';

type ViewMode = 'landing' | 'wordpress' | 'results' | 'gdrive' | 'gdrive-results';

const Index = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('landing');
  const [currentQuery, setCurrentQuery] = useState('');

  // Local SiftOps hook for WordPress sources
  const {
    sourcesStatus,
    refreshSources,
    syncSource,
    isSyncing,
    syncingSourceId,
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
  } = useLocalSiftOps();

  // Google Drive hook
  const gdrive = useGoogleDrive();

  useEffect(() => {
    refreshSources();
  }, [refreshSources]);

  // Handle OAuth callback - when returning from Google OAuth, automatically go to gdrive view
  useEffect(() => {
    if (gdrive.justConnected && viewMode === 'landing') {
      setViewMode('gdrive');
    }
  }, [gdrive.justConnected, viewMode]);

  const handleSelectSourceType = async (type: 'wordpress' | 'local' | 'onedrive' | 'gdrive') => {
    if (type === 'wordpress') {
      setViewMode('wordpress');
    } else if (type === 'gdrive') {
      await gdrive.checkConnection();
      if (gdrive.connection) {
        setViewMode('gdrive');
      } else {
        await gdrive.connect();
      }
    }
  };

  const handleSearch = async (query: string) => {
    setCurrentQuery(query);
    setViewMode('results');
    await search(query);
  };

  const handleGDriveSearch = async (query: string) => {
    setCurrentQuery(query);
    setViewMode('gdrive-results');
    await gdrive.search(query);
  };

  const handleSync = async (sourceId: string) => {
    await syncSource(sourceId);
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
        sources={sourcesStatus.sources}
        isSyncing={isSyncing}
        syncingSourceId={syncingSourceId}
        onBack={() => setViewMode('landing')}
        onSearch={handleSearch}
        onSync={handleSync}
        onRefresh={refreshSources}
      />
    );
  }

  if (viewMode === 'gdrive') {
    return (
      <GoogleDriveView
        onBack={() => setViewMode('landing')}
        onSearch={handleGDriveSearch}
      />
    );
  }

  if (viewMode === 'gdrive-results') {
    return (
      <GDriveResultsView
        query={currentQuery}
        results={gdrive.results}
        searchReason={gdrive.searchReason}
        isSearching={gdrive.isSearching}
        onSearch={handleGDriveSearch}
        bundle={gdrive.bundle}
        onCreateBundle={gdrive.createBundle}
        onAddToBundle={gdrive.addToBundle}
        onRemoveFromBundle={gdrive.removeFromBundle}
        onLockBundle={gdrive.lockBundle}
        onClearBundle={gdrive.clearBundle}
        ragResponse={gdrive.ragResponse}
        isAsking={gdrive.isAsking}
        onAsk={gdrive.askQuestion}
        onGoHome={() => setViewMode('landing')}
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
      onSync={() => {}}
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
