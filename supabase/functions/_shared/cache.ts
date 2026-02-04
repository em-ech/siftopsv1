/**
 * LRU Cache for query embeddings.
 *
 * Configuration:
 * - MAX_ENTRIES: 1000 entries maximum
 * - TTL: 5 minutes (300000ms)
 *
 * Cache key is a normalized query string hash.
 */

const MAX_ENTRIES = 1000;
const TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CacheEntry {
  embedding: string;
  timestamp: number;
}

// In-memory LRU cache
// Note: This persists within a single Deno isolate instance.
// For distributed caching across instances, use the database table.
const memoryCache = new Map<string, CacheEntry>();
const accessOrder: string[] = [];

/**
 * Normalize a query string for cache key generation.
 * Lowercases, trims, and normalizes whitespace.
 */
export function normalizeQuery(query: string): string {
  return String(query || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * Generate a hash key for a query string.
 * Uses a simple but fast hashing algorithm.
 */
export function hashQuery(query: string): string {
  const normalized = normalizeQuery(query);
  let hash = 0;

  for (let i = 0; i < normalized.length; i++) {
    const char = normalized.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  return `qc_${Math.abs(hash).toString(36)}`;
}

/**
 * Get an embedding from the memory cache.
 * Returns null if not found or expired.
 */
export function getFromMemoryCache(query: string): string | null {
  const key = hashQuery(query);
  const entry = memoryCache.get(key);

  if (!entry) {
    return null;
  }

  // Check if expired
  if (Date.now() - entry.timestamp > TTL_MS) {
    memoryCache.delete(key);
    const idx = accessOrder.indexOf(key);
    if (idx > -1) accessOrder.splice(idx, 1);
    return null;
  }

  // Update access order (LRU)
  const idx = accessOrder.indexOf(key);
  if (idx > -1) accessOrder.splice(idx, 1);
  accessOrder.push(key);

  return entry.embedding;
}

/**
 * Store an embedding in the memory cache.
 */
export function setInMemoryCache(query: string, embedding: string): void {
  const key = hashQuery(query);

  // Evict oldest entries if at capacity
  while (memoryCache.size >= MAX_ENTRIES && accessOrder.length > 0) {
    const oldestKey = accessOrder.shift();
    if (oldestKey) {
      memoryCache.delete(oldestKey);
    }
  }

  memoryCache.set(key, {
    embedding,
    timestamp: Date.now(),
  });

  accessOrder.push(key);
}

/**
 * Clear expired entries from the memory cache.
 * Call this periodically or before cache operations.
 */
export function cleanMemoryCache(): number {
  const now = Date.now();
  let cleaned = 0;

  for (const [key, entry] of memoryCache.entries()) {
    if (now - entry.timestamp > TTL_MS) {
      memoryCache.delete(key);
      const idx = accessOrder.indexOf(key);
      if (idx > -1) accessOrder.splice(idx, 1);
      cleaned++;
    }
  }

  return cleaned;
}

/**
 * Get cache statistics.
 */
export function getCacheStats(): {
  size: number;
  maxSize: number;
  hitRate?: number;
} {
  return {
    size: memoryCache.size,
    maxSize: MAX_ENTRIES,
  };
}

// Database-backed cache functions for distributed caching

import { getServiceClient } from "./supabase.ts";

/**
 * Get an embedding from the database cache.
 * Falls back to database if not in memory.
 */
export async function getFromDbCache(query: string): Promise<string | null> {
  // First check memory cache
  const memoryResult = getFromMemoryCache(query);
  if (memoryResult) {
    return memoryResult;
  }

  // Check database
  try {
    const supabase = getServiceClient();
    const queryHash = hashQuery(query);

    const { data, error } = await supabase
      .from("query_cache")
      .select("embedding")
      .eq("query_hash", queryHash)
      .gt("expires_at", new Date().toISOString())
      .single();

    if (error || !data) {
      return null;
    }

    // Store in memory cache for faster subsequent access
    const embeddingStr = JSON.stringify(data.embedding);
    setInMemoryCache(query, embeddingStr);

    return embeddingStr;
  } catch {
    return null;
  }
}

/**
 * Store an embedding in both memory and database cache.
 */
export async function setInDbCache(query: string, embedding: string): Promise<void> {
  // Store in memory cache
  setInMemoryCache(query, embedding);

  // Store in database for persistence
  try {
    const supabase = getServiceClient();
    const queryHash = hashQuery(query);
    const expiresAt = new Date(Date.now() + TTL_MS).toISOString();

    await supabase
      .from("query_cache")
      .upsert({
        query_hash: queryHash,
        query_text: normalizeQuery(query),
        embedding: embedding,
        expires_at: expiresAt,
      }, {
        onConflict: "query_hash",
      });
  } catch (err) {
    // Log but don't fail - memory cache is still valid
    console.error("Failed to store in database cache:", err);
  }
}

/**
 * Clean expired entries from database cache.
 */
export async function cleanDbCache(): Promise<void> {
  try {
    const supabase = getServiceClient();
    await supabase.rpc("clean_expired_query_cache");
  } catch (err) {
    console.error("Failed to clean database cache:", err);
  }
}
