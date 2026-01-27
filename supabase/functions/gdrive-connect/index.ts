import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check if already connected
    const { data: existing } = await supabase
      .from("gdrive_connections")
      .select("*")
      .limit(1);

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
    const demoEmail = "demo@siftops.com";
    
    const { data: connection, error: insertError } = await supabase
      .from("gdrive_connections")
      .insert({
        email: demoEmail,
        access_token: "demo_access_token",
        refresh_token: "demo_refresh_token",
        token_expires_at: new Date(Date.now() + 3600000).toISOString(),
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
