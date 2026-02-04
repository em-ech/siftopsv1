import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getServiceClient } from "../_shared/supabase.ts";
import { getUserIdOptional } from "../_shared/auth.ts";
import { normalizeQuery } from "../_shared/cache.ts";

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

    const supabase = getServiceClient();
    const userId = await getUserIdOptional(req);

    const querySig = normalizeQuery(query);

    // Get existing feedback (with user filtering)
    let feedbackQuery = supabase
      .from("feedback")
      .select("*")
      .eq("query_signature", querySig)
      .eq("doc_id", docId);

    if (userId) {
      feedbackQuery = feedbackQuery.eq("user_id", userId);
    }

    const { data: existing } = await feedbackQuery.maybeSingle();

    const currentWeight = existing?.weight || 0;
    const newWeight = label === 1 ? currentWeight + 1 : currentWeight - 1;

    // Upsert feedback with user_id
    const { error } = await supabase
      .from("feedback")
      .upsert({
        query_signature: querySig,
        doc_id: docId,
        weight: newWeight,
        user_id: userId,
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
