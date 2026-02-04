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

    // Delete connections (cascades to files, chunks, sync_status)
    // With user filtering for multi-tenant support
    let deleteQuery = supabase
      .from("gdrive_connections")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");

    if (userId) {
      deleteQuery = deleteQuery.eq("user_id", userId);
    }

    const { error } = await deleteQuery;

    if (error) {
      throw error;
    }

    console.log("Disconnected Google Drive connections for user:", userId || "all");

    return new Response(
      JSON.stringify({ ok: true, message: "Disconnected successfully" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Disconnect error:", error);
    return new Response(
      JSON.stringify({ ok: false, error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
