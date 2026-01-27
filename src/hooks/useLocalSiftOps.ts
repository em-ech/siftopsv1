import { useState, useCallback } from 'react';
import { API_BASE, getAuthHeaders } from '@/config/api';
import { SearchResult, Bundle, RAGResponse } from '@/types/siftops';

interface Source {
  sourceId: string;
  name: string;
  baseUrl: string;
  status: 'not_indexed' | 'indexing' | 'indexed' | 'error';
  docs: number;
  chunks: number;
  lastSync: string | null;
  lastError: string | null;
}

interface SourcesStatus {
  sources: Source[];
  totals: { totalDocs: number };
}

async function apiGet(endpoint: string) {
  const response = await fetch(`${API_BASE}/${endpoint}`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });
  return response.json();
}

async function apiPost(endpoint: string, body: Record<string, unknown> = {}) {
  const response = await fetch(`${API_BASE}/${endpoint}`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
  });
  return response.json();
}

export function useLocalSiftOps() {
  // Sources state
  const [sourcesStatus, setSourcesStatus] = useState<SourcesStatus>({
    sources: [],
    totals: { totalDocs: 0 },
  });
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncingSourceId, setSyncingSourceId] = useState<string | null>(null);

  // Search state
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchReason, setSearchReason] = useState<string | null>(null);

  // Bundle state
  const [bundle, setBundle] = useState<Bundle | null>(null);

  // RAG state
  const [ragResponse, setRagResponse] = useState<RAGResponse | null>(null);
  const [isAsking, setIsAsking] = useState(false);

  // Fetch sources list
  const refreshSources = useCallback(async () => {
    try {
      const data = await apiGet('source/list');
      if (data.ok) {
        setSourcesStatus({
          sources: data.sources || [],
          totals: data.totals || { totalDocs: 0 },
        });
      }
    } catch (error) {
      console.error('Failed to fetch sources:', error);
    }
  }, []);

  // Sync a specific source
  const syncSource = useCallback(async (sourceId: string) => {
    setIsSyncing(true);
    setSyncingSourceId(sourceId);
    
    try {
      const data = await apiPost('source/sync', { sourceId });
      if (data.ok) {
        setSourcesStatus(prev => ({
          sources: prev.sources.map(s => 
            s.sourceId === sourceId ? data.source : s
          ),
          totals: data.totals || prev.totals,
        }));
      }
    } catch (error) {
      console.error('Sync error:', error);
    } finally {
      setIsSyncing(false);
      setSyncingSourceId(null);
    }
  }, []);

  // Search
  const search = useCallback(async (query: string, sourceIds?: string[]) => {
    if (!query.trim()) {
      setResults([]);
      setSearchReason(null);
      return;
    }

    setIsSearching(true);
    setSearchReason(null);

    try {
      const data = await apiPost('search', { query, sourceIds });
      if (data.ok) {
        // Map to SearchResult format
        const mappedResults: SearchResult[] = (data.results || []).map((r: any) => ({
          docId: r.docId,
          type: r.type,
          title: r.title,
          url: r.url,
          snippet: r.snippet,
          score: r.score,
          sourceName: r.sourceName,
          sourceId: r.sourceId,
        }));
        setResults(mappedResults);
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

  // Bundle operations
  const createBundle = useCallback(async (): Promise<string | null> => {
    try {
      const data = await apiPost('bundle/create');
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
      const data = await apiPost('bundle/add', {
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
      const data = await apiPost('bundle/remove', {
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
      const data = await apiPost('bundle/lock', {
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
      const data = await apiPost('bundle/clear', {
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

  // Ask question (RAG)
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

  return {
    // Sources
    sourcesStatus,
    refreshSources,
    syncSource,
    isSyncing,
    syncingSourceId,

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
  };
}
