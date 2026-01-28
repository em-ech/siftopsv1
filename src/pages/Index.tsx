import { useEffect, useState } from 'react';
import { LandingView } from '@/components/siftops/LandingView';
import { WordPressSitesView } from '@/components/siftops/WordPressSitesView';
import { ResultsView } from '@/components/siftops/ResultsView';
import { GoogleDriveView } from '@/components/siftops/GoogleDriveView';
import { GDriveResultsView } from '@/components/siftops/GDriveResultsView';
import { useSiftOps } from '@/hooks/useSiftOps';
import { useGoogleDrive } from '@/hooks/useGoogleDrive';

type ViewMode = 'landing' | 'wordpress' | 'results' | 'gdrive' | 'gdrive-results';

const Index = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('landing');
  const [currentQuery, setCurrentQuery] = useState('');

  // WordPress / existing SiftOps hook
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

  // Google Drive hook
  const gdrive = useGoogleDrive();

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  // Handle OAuth callback - when returning from Google OAuth, automatically go to gdrive view
  useEffect(() => {
    if (gdrive.justConnected && viewMode === 'landing') {
      // User just completed OAuth, go directly to Drive view
      setViewMode('gdrive');
    }
  }, [gdrive.justConnected, viewMode]);

  const handleSelectSourceType = async (type: 'wordpress' | 'local' | 'onedrive' | 'gdrive') => {
    if (type === 'wordpress') {
      setViewMode('wordpress');
    } else if (type === 'gdrive') {
      // Check if already connected
      await gdrive.checkConnection();
      if (gdrive.connection) {
        // Already connected, go to Drive view
        setViewMode('gdrive');
      } else {
        // Not connected - trigger OAuth immediately
        await gdrive.connect();
        // The OAuth redirect will happen, user will return to the app
        // The OAuth callback handling in useGoogleDrive will set the connection
      }
    }
    // Other source types coming soon
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
