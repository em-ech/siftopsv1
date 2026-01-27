import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get sync status - use the fixed UUID row
    const { data: syncStatus } = await supabase
      .from("sync_status")
      .select("*")
      .eq("id", "00000000-0000-0000-0000-000000000001")
      .maybeSingle();

    // Get actual counts
    const { count: docsCount } = await supabase
      .from("documents")
      .select("*", { count: "exact", head: true });

    const { count: chunksCount } = await supabase
      .from("document_chunks")
      .select("*", { count: "exact", head: true });

    return new Response(
      JSON.stringify({
        ok: true,
        docs: docsCount || 0,
        chunks: chunksCount || 0,
        syncedAt: syncStatus?.synced_at || null,
        status: syncStatus?.status || "idle",
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
