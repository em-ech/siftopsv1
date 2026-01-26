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
    const { query, docId, label } = await req.json();

    if (!query || !docId || (label !== 1 && label !== 0)) {
      return new Response(
        JSON.stringify({ ok: false, error: "Invalid parameters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const querySig = String(query).toLowerCase().trim().replace(/\s+/g, " ");

    // Get existing feedback
    const { data: existing } = await supabase
      .from("feedback")
      .select("*")
      .eq("query_signature", querySig)
      .eq("doc_id", docId)
      .maybeSingle();

    const currentWeight = existing?.weight || 0;
    const newWeight = label === 1 ? currentWeight + 1 : currentWeight - 1;

    // Upsert feedback
    const { error } = await supabase
      .from("feedback")
      .upsert({
        query_signature: querySig,
        doc_id: docId,
        weight: newWeight,
      }, { onConflict: "query_signature,doc_id" });

    if (error) throw error;

    return new Response(
      JSON.stringify({ ok: true, weight: newWeight }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Feedback error:", error);
    return new Response(
      JSON.stringify({ ok: false, error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
