import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// Singleton Supabase client for connection pooling
// In Deno Deploy, the runtime reuses the same isolate for multiple requests,
// so this effectively provides connection pooling within the same instance.

let _serviceClient: SupabaseClient | null = null;

/**
 * Get a Supabase client with service role key (for admin operations).
 * Uses singleton pattern to reuse connections across requests.
 */
export function getServiceClient(): SupabaseClient {
  if (!_serviceClient) {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables");
    }

    _serviceClient = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  return _serviceClient;
}

/**
 * Get a Supabase client authenticated as a specific user.
 * This creates a new client with the user's JWT for RLS policies.
 */
export function getUserClient(authHeader: string | null): SupabaseClient {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables");
  }

  const options: any = {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  };

  // If auth header provided, set it as the global header
  if (authHeader) {
    options.global = {
      headers: {
        Authorization: authHeader,
      },
    };
  }

  return createClient(supabaseUrl, supabaseAnonKey, options);
}

/**
 * Get Supabase URL for direct use
 */
export function getSupabaseUrl(): string {
  const url = Deno.env.get("SUPABASE_URL");
  if (!url) {
    throw new Error("Missing SUPABASE_URL environment variable");
  }
  return url;
}
