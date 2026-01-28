// API configuration
// Set USE_LOCAL_SERVER to true when running with local Ollama backend
// Set to false to use Supabase edge functions

export const USE_LOCAL_SERVER = false;

export const LOCAL_API_BASE = 'http://localhost:8080/api';

export const SUPABASE_API_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

export const API_BASE = USE_LOCAL_SERVER ? LOCAL_API_BASE : SUPABASE_API_BASE;

// Helper for authorization header (only needed for Supabase)
export function getAuthHeaders(): Record<string, string> {
  if (USE_LOCAL_SERVER) {
    return { 'Content-Type': 'application/json' };
  }
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
  };
}
