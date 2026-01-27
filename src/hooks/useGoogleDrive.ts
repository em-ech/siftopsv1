import { useState, useCallback, useEffect } from 'react';
import { GDriveConnection, GDriveSyncStatus, GDriveSearchResult } from '@/types/gdrive';
import { Bundle, RAGResponse } from '@/types/siftops';

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

export function useGoogleDrive() {
  // Connection state
  const [connection, setConnection] = useState<GDriveConnection | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  // Sync state
  const [syncStatus, setSyncStatus] = useState<GDriveSyncStatus>({
    filesCount: 0,
    chunksCount: 0,
    status: 'idle',
    syncedAt: null,
    error: null,
  });
  const [isSyncing, setIsSyncing] = useState(false);

  // Search state
  const [results, setResults] = useState<GDriveSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchReason, setSearchReason] = useState<string | null>(null);
  const [currentQuery, setCurrentQuery] = useState('');

  // Bundle state (reuse same pattern as WordPress)
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [ragResponse, setRagResponse] = useState<RAGResponse | null>(null);
  const [isAsking, setIsAsking] = useState(false);

  // Check for OAuth callback on mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');
    
    if (code && state) {
      // Handle OAuth callback
      handleOAuthCallback(code);
    }
  }, []);

  const handleOAuthCallback = async (code: string) => {
    setIsConnecting(true);
    try {
      // Get the redirect URI (current page without query params)
      const redirectUri = `${window.location.origin}${window.location.pathname}`;
      
      const data = await apiPost('gdrive-callback', { code, redirectUri });
      
      if (data.ok) {
        setConnection({
          id: data.connectionId,
          email: data.email,
          connected: true,
        });
        
        // Clear the URL params
        window.history.replaceState({}, document.title, window.location.pathname);
      } else {
        console.error('OAuth callback failed:', data.error);
      }
    } catch (error) {
      console.error('OAuth callback error:', error);
    } finally {
      setIsConnecting(false);
    }
  };

  // Check connection status
  const checkConnection = useCallback(async () => {
    try {
      const data = await apiPost('gdrive-status');
      if (data.ok && data.connected) {
        setConnection({
          id: data.connectionId,
          email: data.email,
          connected: true,
        });
        setSyncStatus({
          filesCount: data.filesCount || 0,
          chunksCount: data.chunksCount || 0,
          status: data.status || 'idle',
          syncedAt: data.syncedAt || null,
          error: null,
        });
      } else {
        setConnection(null);
      }
    } catch (error) {
      console.error('Check connection error:', error);
      setConnection(null);
    }
  }, []);

  // Connect to Google Drive via OAuth
  const connect = useCallback(async () => {
    setIsConnecting(true);
    try {
      // Get the redirect URI (current page)
      const redirectUri = `${window.location.origin}${window.location.pathname}`;
      
      const data = await apiPost('gdrive-auth-url', { redirectUri });
      
      if (data.ok && data.authUrl) {
        // Redirect to Google OAuth
        window.location.href = data.authUrl;
        return true;
      }
      
      console.error('Failed to get auth URL:', data.error);
      return false;
    } catch (error) {
      console.error('Connect error:', error);
      return false;
    } finally {
      setIsConnecting(false);
    }
  }, []);

  // Disconnect
  const disconnect = useCallback(async () => {
    try {
      const data = await apiPost('gdrive-disconnect');
      if (data.ok) {
        setConnection(null);
        setSyncStatus({
          filesCount: 0,
          chunksCount: 0,
          status: 'idle',
          syncedAt: null,
          error: null,
        });
        setResults([]);
      }
    } catch (error) {
      console.error('Disconnect error:', error);
    }
  }, []);

  // Sync/index Google Drive files
  const syncDrive = useCallback(async (folderId?: string) => {
    if (!connection) return;

    setIsSyncing(true);
    setSyncStatus(prev => ({ ...prev, status: 'indexing', error: null }));

    try {
      const data = await apiPost('gdrive-sync', { 
        connectionId: connection.id,
        folderId: folderId || undefined,
      });
      
      if (data.ok) {
        setSyncStatus({
          filesCount: data.filesCount || 0,
          chunksCount: data.chunksCount || 0,
          status: data.hasMore ? 'indexing' : 'indexed',
          syncedAt: new Date().toISOString(),
          error: null,
        });
      } else {
        setSyncStatus(prev => ({ ...prev, status: 'error', error: data.error }));
      }
    } catch (error) {
      console.error('Sync error:', error);
      setSyncStatus(prev => ({ ...prev, status: 'error', error: String(error) }));
    } finally {
      setIsSyncing(false);
    }
  }, [connection]);

  // Search Google Drive
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
      const data = await apiPost('gdrive-search', { query });
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

  // Bundle operations (same pattern as WordPress)
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

  // Ask question (RAG)
  const askQuestion = useCallback(async (question: string) => {
    if (!bundle?.locked || !question.trim()) return;

    setIsAsking(true);
    setRagResponse(null);

    try {
      const data = await apiPost('gdrive-ask', {
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
    // Connection
    connection,
    isConnecting,
    checkConnection,
    connect,
    disconnect,

    // Sync
    syncStatus,
    isSyncing,
    syncDrive,

    // Search
    results,
    isSearching,
    searchReason,
    currentQuery,
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
