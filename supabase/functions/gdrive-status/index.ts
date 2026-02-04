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

    // Check for existing connection (with user filtering)
    let connQuery = supabase
      .from("gdrive_connections")
      .select("*");

    if (userId) {
      connQuery = connQuery.or(`user_id.eq.${userId},user_id.is.null`);
    }

    const { data: connections } = await connQuery.limit(1);

    if (!connections || connections.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, connected: false }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const connection = connections[0];

    // Get sync status
    const { data: syncStatus } = await supabase
      .from("gdrive_sync_status")
      .select("*")
      .eq("connection_id", connection.id)
      .single();

    return new Response(
      JSON.stringify({
        ok: true,
        connected: true,
        connectionId: connection.id,
        email: connection.email,
        filesCount: syncStatus?.files_count || 0,
        chunksCount: syncStatus?.chunks_count || 0,
        status: syncStatus?.status || "idle",
        syncedAt: syncStatus?.synced_at || null,
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
