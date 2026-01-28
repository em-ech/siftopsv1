import { useState, useCallback } from 'react';
import { SearchResult, Bundle, SyncStatus, RAGResponse } from '@/types/siftops';
import { API_BASE, getAuthHeaders, USE_LOCAL_SERVER } from '@/config/api';

async function apiPost(endpoint: string, body: Record<string, unknown> = {}) {
  const response = await fetch(`${API_BASE}/${endpoint}`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
  });
  return response.json();
}

async function apiGet(endpoint: string) {
  const response = await fetch(`${API_BASE}/${endpoint}`, {
    method: USE_LOCAL_SERVER ? 'GET' : 'POST',
    headers: getAuthHeaders(),
    ...(USE_LOCAL_SERVER ? {} : { body: JSON.stringify({}) }),
  });
  return response.json();
}

export function useSiftOps() {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchReason, setSearchReason] = useState<string | null>(null);
  const [currentQuery, setCurrentQuery] = useState('');

  const [status, setStatus] = useState<SyncStatus>({
    docs: 0,
    chunks: 0,
    syncedAt: null,
    status: 'idle',
  });
  const [isSyncing, setIsSyncing] = useState(false);

  const [bundle, setBundle] = useState<Bundle | null>(null);
  
  const [ragResponse, setRagResponse] = useState<RAGResponse | null>(null);
  const [isAsking, setIsAsking] = useState(false);

  const refreshStatus = useCallback(async () => {
    try {
      if (USE_LOCAL_SERVER) {
        // Local server uses source/list endpoint
        const data = await apiGet('source/list');
        if (data.ok && data.sources) {
          const mozilla = data.sources.find((s: any) => s.sourceId === 'mozilla');
          if (mozilla) {
            setStatus({
              docs: mozilla.docs || 0,
              chunks: mozilla.chunks || 0,
              syncedAt: mozilla.lastSync || null,
              status: mozilla.status === 'indexed' ? 'complete' : mozilla.status || 'idle',
            });
          }
        }
      } else {
        const data = await apiGet('status');
        if (data.ok) {
          setStatus({
            docs: data.docs || 0,
            chunks: data.chunks || 0,
            syncedAt: data.syncedAt || null,
            status: data.status || 'idle',
          });
        }
      }
    } catch (error) {
      console.error('Status refresh error:', error);
    }
  }, []);

  const syncMozilla = useCallback(async () => {
    setIsSyncing(true);
    setStatus(prev => ({ ...prev, status: 'syncing' }));
    
    try {
      console.log('Syncing Mozilla Blog...');
      if (USE_LOCAL_SERVER) {
        // Local server uses source/sync endpoint
        const data = await apiPost('source/sync', { sourceId: 'mozilla' });
        if (data.ok && data.source) {
          console.log(`Mozilla: ${data.source.docs} docs, ${data.source.chunks} chunks`);
          setStatus({
            docs: data.source.docs || 0,
            chunks: data.source.chunks || 0,
            syncedAt: data.source.lastSync || new Date().toISOString(),
            status: 'complete',
          });
        }
      } else {
        const data = await apiPost('sync-wordpress', { sourceId: 'mozilla' });
        if (data.ok) {
          console.log(`Mozilla: ${data.docsInserted} docs, ${data.chunksCreated} chunks`);
          setStatus({
            docs: data.totalDocs || 0,
            chunks: data.totalChunks || 0,
            syncedAt: new Date().toISOString(),
            status: 'complete',
          });
        }
      }
    } catch (error) {
      console.error('Sync error:', error);
      setStatus(prev => ({ ...prev, status: 'error' }));
    } finally {
      setIsSyncing(false);
      await refreshStatus();
    }
  }, [refreshStatus]);

  const search = useCallback(async (query: string) => {
    if (!query.trim()) {
      setResults([]);
      setSearchReason(null);
      return;
    }

    setIsSearching(true);
    setCurrentQuery(query);
    setSearchReason(null);

    try {
      const data = await apiPost('search', { query });
      if (data.ok) {
        setResults(data.results || []);
        setSearchReason(data.reason || null);
      } else {
        setResults([]);
        setSearchReason('error');
      }
    } catch (error) {
      console.error('Search error:', error);
      setResults([]);
      setSearchReason('error');
    } finally {
      setIsSearching(false);
    }
  }, []);

  const createBundle = useCallback(async (): Promise<string | null> => {
    try {
      const endpoint = USE_LOCAL_SERVER ? 'bundle/create' : 'bundle';
      const body = USE_LOCAL_SERVER ? {} : { action: 'create' };
      const data = await apiPost(endpoint, body);
      if (data.ok) {
        const newBundle = {
          bundleId: data.bundleId,
          docIds: [],
          locked: false,
        };
        setBundle(newBundle);
        setRagResponse(null);
        return data.bundleId;
      }
      return null;
    } catch (error) {
      console.error('Create bundle error:', error);
      return null;
    }
  }, []);

  const addToBundle = useCallback(async (docId: string, existingBundleId?: string) => {
    const bundleIdToUse = existingBundleId || bundle?.bundleId;
    if (!bundleIdToUse) {
      console.error('No bundle to add to');
      return;
    }

    try {
      const endpoint = USE_LOCAL_SERVER ? 'bundle/add' : 'bundle';
      const body = USE_LOCAL_SERVER 
        ? { bundleId: bundleIdToUse, docId }
        : { action: 'add', bundleId: bundleIdToUse, docId };
      const data = await apiPost(endpoint, body);
      if (data.ok) {
        setBundle(prev => prev ? { ...prev, docIds: data.docIds || [] } : {
          bundleId: bundleIdToUse,
          docIds: data.docIds || [],
          locked: false,
        });
      }
    } catch (error) {
      console.error('Add to bundle error:', error);
    }
  }, [bundle]);

  const removeFromBundle = useCallback(async (docId: string) => {
    if (!bundle) return;

    try {
      const endpoint = USE_LOCAL_SERVER ? 'bundle/remove' : 'bundle';
      const body = USE_LOCAL_SERVER 
        ? { bundleId: bundle.bundleId, docId }
        : { action: 'remove', bundleId: bundle.bundleId, docId };
      const data = await apiPost(endpoint, body);
      if (data.ok) {
        setBundle(prev => prev ? { ...prev, docIds: data.docIds || [] } : null);
      }
    } catch (error) {
      console.error('Remove from bundle error:', error);
    }
  }, [bundle]);

  const lockBundle = useCallback(async () => {
    if (!bundle) return;

    try {
      const endpoint = USE_LOCAL_SERVER ? 'bundle/lock' : 'bundle';
      const body = USE_LOCAL_SERVER 
        ? { bundleId: bundle.bundleId }
        : { action: 'lock', bundleId: bundle.bundleId };
      const data = await apiPost(endpoint, body);
      if (data.ok) {
        setBundle(prev => prev ? { ...prev, locked: true } : null);
      }
    } catch (error) {
      console.error('Lock bundle error:', error);
    }
  }, [bundle]);

  const clearBundle = useCallback(async () => {
    if (!bundle) return;

    try {
      const endpoint = USE_LOCAL_SERVER ? 'bundle/clear' : 'bundle';
      const body = USE_LOCAL_SERVER 
        ? { bundleId: bundle.bundleId }
        : { action: 'clear', bundleId: bundle.bundleId };
      const data = await apiPost(endpoint, body);
      if (data.ok) {
        setBundle(prev => prev ? { ...prev, docIds: [], locked: false } : null);
        setRagResponse(null);
      }
    } catch (error) {
      console.error('Clear bundle error:', error);
    }
  }, [bundle]);

  const askQuestion = useCallback(async (question: string) => {
    if (!bundle?.locked || !question.trim()) return;

    setIsAsking(true);
    setRagResponse(null);

    try {
      const data = await apiPost('ask', {
        bundleId: bundle.bundleId,
        question,
      });
      if (data.ok) {
        setRagResponse({
          answer: data.answer || 'Not found in selected sources',
          citations: data.citations || [],
        });
      } else {
        setRagResponse({
          answer: data.error || 'Request failed',
          citations: [],
        });
      }
    } catch (error) {
      console.error('Ask error:', error);
      setRagResponse({
        answer: 'Request failed',
        citations: [],
      });
    } finally {
      setIsAsking(false);
    }
  }, [bundle]);

  const submitFeedback = useCallback(async (docId: string, helpful: boolean) => {
    if (!currentQuery) return;

    try {
      await apiPost('feedback', {
        query: currentQuery,
        docId,
        label: helpful ? 1 : 0,
      });
      // Re-search to get updated rankings
      await search(currentQuery);
    } catch (error) {
      console.error('Feedback error:', error);
    }
  }, [currentQuery, search]);

  return {
    // Status
    status,
    isSyncing,
    refreshStatus,
    syncTechCrunch: syncMozilla, // Alias for backward compatibility

    // Search
    results,
    isSearching,
    searchReason,
    search,

    // Bundle
    bundle,
    createBundle,
    addToBundle,
    removeFromBundle,
    lockBundle,
    clearBundle,

    // RAG
    ragResponse,
    isAsking,
    askQuestion,

    // Feedback
    submitFeedback,
  };
}
