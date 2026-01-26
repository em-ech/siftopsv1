export interface SearchResult {
  doc_id: string;
  title: string;
  location: string;
  snippet: string;
  score: number;
}

export interface Bundle {
  id: string;
  docs: string[];
  locked: boolean;
}

export interface RAGResponse {
  answer: string;
  citations: Citation[];
}

export interface Citation {
  citation: string;
  location: string;
  excerpt: string;
}

export interface User {
  id: string;
  groups: string[];
}
