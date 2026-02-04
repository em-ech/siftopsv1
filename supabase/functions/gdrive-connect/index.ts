import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getServiceClient } from "../_shared/supabase.ts";
import { getUserIdOptional } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Demo connection - simulates OAuth flow
// In production, this would redirect to Google OAuth consent screen
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = getServiceClient();
    const userId = await getUserIdOptional(req);

    // Check if already connected (with user filtering)
    let existingQuery = supabase
      .from("gdrive_connections")
      .select("*");

    if (userId) {
      existingQuery = existingQuery.eq("user_id", userId);
    }

    const { data: existing } = await existingQuery.limit(1);

    if (existing && existing.length > 0) {
      return new Response(
        JSON.stringify({
          ok: true,
          connectionId: existing[0].id,
          email: existing[0].email,
          message: "Already connected",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Demo: Create a simulated connection
    // In production, this would exchange OAuth code for tokens
    const demoEmail = userId ? `user_${userId.slice(0, 8)}@siftops.com` : "demo@siftops.com";

    const { data: connection, error: insertError } = await supabase
      .from("gdrive_connections")
      .insert({
        email: demoEmail,
        access_token: "demo_access_token",
        refresh_token: "demo_refresh_token",
        token_expires_at: new Date(Date.now() + 3600000).toISOString(),
        user_id: userId,
      })
      .select()
      .single();

    if (insertError) {
      throw insertError;
    }

    // Create sync status entry
    await supabase
      .from("gdrive_sync_status")
      .insert({
        connection_id: connection.id,
        status: "idle",
      });

    console.log("Created demo connection:", connection.id);

    return new Response(
      JSON.stringify({
        ok: true,
        connectionId: connection.id,
        email: demoEmail,
        message: "Connected successfully (demo mode)",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Connect error:", error);
    return new Response(
      JSON.stringify({ ok: false, error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
