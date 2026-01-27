import { useState, useCallback } from 'react';
import { SearchResult, Bundle, SyncStatus, RAGResponse } from '@/types/siftops';

const API_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

async function apiPost(endpoint: string, body: Record<string, unknown> = {}) {
  const response = await fetch(`${API_BASE}/${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify(body),
  });
  return response.json();
}

async function apiGet(endpoint: string) {
  const response = await fetch(`${API_BASE}/${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify({}),
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
      const data = await apiGet('status');
      if (data.ok) {
        setStatus({
          docs: data.docs || 0,
          chunks: data.chunks || 0,
          syncedAt: data.syncedAt || null,
          status: data.status || 'idle',
        });
      }
    } catch (error) {
      console.error('Status refresh error:', error);
    }
  }, []);

  const syncTechCrunch = useCallback(async () => {
    setIsSyncing(true);
    setStatus(prev => ({ ...prev, status: 'syncing' }));
    
    try {
      const data = await apiPost('sync-techcrunch');
      if (data.ok) {
        setStatus({
          docs: data.totalDocs || data.docs || 0,
          chunks: data.totalChunks || data.chunks || 0,
          syncedAt: new Date().toISOString(),
          status: data.hasMore ? 'partial' : 'complete',
        });
      } else {
        setStatus(prev => ({ ...prev, status: 'error' }));
      }
    } catch (error) {
      console.error('Sync error:', error);
      setStatus(prev => ({ ...prev, status: 'error' }));
    } finally {
      setIsSyncing(false);
      // Refresh status to get accurate counts
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
      const data = await apiPost('bundle', { action: 'create' });
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
      const data = await apiPost('bundle', {
        action: 'add',
        bundleId: bundleIdToUse,
        docId,
      });
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
      const data = await apiPost('bundle', {
        action: 'remove',
        bundleId: bundle.bundleId,
        docId,
      });
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
      const data = await apiPost('bundle', {
        action: 'lock',
        bundleId: bundle.bundleId,
      });
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
      const data = await apiPost('bundle', {
        action: 'clear',
        bundleId: bundle.bundleId,
      });
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
    syncTechCrunch,

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
