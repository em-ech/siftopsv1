import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getServiceClient } from "../_shared/supabase.ts";
import { getUserIdOptional } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = getServiceClient();
    const userId = await getUserIdOptional(req);

    // Parse optional sourceId from request
    let sourceId: string | null = null;
    try {
      const body = await req.json();
      sourceId = body.sourceId || null;
    } catch {
      // No body - get overall status
    }

    // Get sync status for specific source or user
    let syncQuery = supabase
      .from("sync_status")
      .select("*");

    if (sourceId) {
      syncQuery = syncQuery.eq("source_id", sourceId);
    }

    if (userId) {
      syncQuery = syncQuery.or(`user_id.eq.${userId},user_id.is.null`);
    }

    const { data: syncStatuses } = await syncQuery;

    // Get actual counts (with user filtering)
    let docsQuery = supabase
      .from("documents")
      .select("*", { count: "exact", head: true });

    if (userId) {
      docsQuery = docsQuery.or(`user_id.eq.${userId},user_id.is.null`);
    }

    if (sourceId) {
      docsQuery = docsQuery.eq("source_id", sourceId);
    }

    const { count: docsCount } = await docsQuery;

    const { count: chunksCount } = await supabase
      .from("document_chunks")
      .select("*", { count: "exact", head: true });

    // Get all sources
    let sourcesQuery = supabase
      .from("sources")
      .select("*");

    if (userId) {
      sourcesQuery = sourcesQuery.or(`user_id.eq.${userId},user_id.is.null`);
    }

    const { data: sources } = await sourcesQuery;

    // Determine overall status
    const latestSync = syncStatuses?.sort((a: any, b: any) =>
      new Date(b.synced_at || 0).getTime() - new Date(a.synced_at || 0).getTime()
    )[0];

    return new Response(
      JSON.stringify({
        ok: true,
        docs: docsCount || 0,
        chunks: chunksCount || 0,
        syncedAt: latestSync?.synced_at || null,
        status: latestSync?.status || "idle",
        sources: sources || [],
        syncStatuses: syncStatuses || [],
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Status error:", error);
    return new Response(
      JSON.stringify({ ok: false, error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
