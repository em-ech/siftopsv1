export interface SearchResult {
  docId: string;
  type: 'post' | 'page';
  title: string;
  url: string;
  snippet: string;
  score: number;
}

export interface Bundle {
  bundleId: string;
  docIds: string[];
  locked: boolean;
}

export interface SyncStatus {
  docs: number;
  chunks: number;
  syncedAt: string | null;
  status: 'idle' | 'syncing' | 'complete' | 'error';
}

export interface RAGResponse {
  answer: string;
  citations: Citation[];
}

export interface Citation {
  citation: string;
  url: string;
  title: string;
  excerpt: string;
}
