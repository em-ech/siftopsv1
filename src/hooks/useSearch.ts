import { useState, useCallback } from 'react';
import { SearchResult, Bundle, RAGResponse } from '@/types/search';

// Mock data for demonstration
const mockResults: SearchResult[] = [
  {
    doc_id: 'wp_1234',
    title: 'Security Policy Documentation',
    location: 'https://internal.company.com/docs/security-policy',
    snippet: 'This document outlines the comprehensive security policies and procedures for handling sensitive data within the organization...',
    score: 0.94,
  },
  {
    doc_id: 'gd_5678',
    title: 'Q4 Financial Report - Confidential',
    location: 'https://drive.google.com/file/d/abc123',
    snippet: 'Quarterly financial performance summary including revenue projections and market analysis for stakeholder review...',
    score: 0.87,
  },
  {
    doc_id: 'od_9012',
    title: 'Engineering Architecture Overview',
    location: 'https://onedrive.com/personal/docs/arch-overview',
    snippet: 'System architecture documentation covering microservices deployment, API gateway configuration, and security layers...',
    score: 0.82,
  },
  {
    doc_id: 'lf_readme',
    title: 'Project README',
    location: 'file:///secure_mount/README.md',
    snippet: 'Getting started guide for the Sift Secure deployment including environment setup and configuration requirements...',
    score: 0.76,
  },
];

export function useSearch() {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [ragResponse, setRagResponse] = useState<RAGResponse | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const search = useCallback(async (query: string) => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    setIsSearching(true);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 600));
    
    // Filter and sort mock results based on query
    const filtered = mockResults.filter(r => 
      r.title.toLowerCase().includes(query.toLowerCase()) ||
      r.snippet.toLowerCase().includes(query.toLowerCase())
    );
    
    setResults(filtered.length > 0 ? filtered : mockResults);
    setIsSearching(false);
  }, []);

  const createBundle = useCallback(() => {
    const newBundle: Bundle = {
      id: 'b_' + Date.now(),
      docs: [],
      locked: false,
    };
    setBundle(newBundle);
    return newBundle.id;
  }, []);

  const addToBundle = useCallback((docId: string) => {
    setBundle(prev => {
      if (!prev || prev.locked) return prev;
      if (prev.docs.includes(docId)) return prev;
      return { ...prev, docs: [...prev.docs, docId] };
    });
  }, []);

  const removeFromBundle = useCallback((docId: string) => {
    setBundle(prev => {
      if (!prev || prev.locked) return prev;
      return { ...prev, docs: prev.docs.filter(id => id !== docId) };
    });
  }, []);

  const lockBundle = useCallback(() => {
    setBundle(prev => prev ? { ...prev, locked: true } : null);
  }, []);

  const unlockBundle = useCallback(() => {
    setBundle(null);
    setRagResponse(null);
  }, []);

  const askRAG = useCallback(async (question: string) => {
    if (!bundle?.locked) return;

    setIsGenerating(true);

    // Simulate RAG API call
    await new Promise(resolve => setTimeout(resolve, 1500));

    const response: RAGResponse = {
      answer: `Based on the locked sources, the answer to "${question}" involves the security protocols outlined in the Security Policy Documentation [C1]. The system architecture described in the Engineering Architecture Overview [C2] provides additional context on implementation details. Specifically, the deployment follows zero-trust principles with permission filtering applied before any vector search results are generated.`,
      citations: [
        {
          citation: 'C1',
          location: 'https://internal.company.com/docs/security-policy',
          excerpt: 'Zero trust security model ensures that no document is retrieved unless ACL allows. Permission filtering occurs before retrieval.',
        },
        {
          citation: 'C2',
          location: 'https://onedrive.com/personal/docs/arch-overview',
          excerpt: 'Vector search implementation uses HNSW algorithm with 384-dimensional embeddings. Results are filtered by user ACL before return.',
        },
      ],
    };

    setRagResponse(response);
    setIsGenerating(false);
  }, [bundle]);

  return {
    results,
    isSearching,
    search,
    bundle,
    createBundle,
    addToBundle,
    removeFromBundle,
    lockBundle,
    unlockBundle,
    ragResponse,
    askRAG,
    isGenerating,
  };
}
