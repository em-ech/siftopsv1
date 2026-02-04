import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getServiceClient } from "../_shared/supabase.ts";
import { getUserIdOptional } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const AI_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { bundleId, question } = await req.json();

    if (!bundleId || !question?.trim()) {
      return new Response(
        JSON.stringify({ ok: false, error: "Missing bundleId or question" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = getServiceClient();
    const userId = await getUserIdOptional(req);
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY")!;

    // Get bundle and verify it's locked (with user filtering)
    let bundleQuery = supabase
      .from("bundles")
      .select("*")
      .eq("bundle_id", bundleId);

    if (userId) {
      bundleQuery = bundleQuery.or(`user_id.eq.${userId},user_id.is.null`);
    }

    const { data: bundle, error: bundleError } = await bundleQuery.maybeSingle();

    if (bundleError || !bundle) {
      return new Response(
        JSON.stringify({ ok: false, error: "Bundle not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!bundle.locked) {
      return new Response(
        JSON.stringify({ ok: false, error: "Bundle must be locked to ask questions" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get bundle documents
    const { data: bundleDocs } = await supabase
      .from("bundle_documents")
      .select("document_id")
      .eq("bundle_id", bundle.id);

    if (!bundleDocs || bundleDocs.length === 0) {
      return new Response(
        JSON.stringify({
          ok: true,
          answer: "Not found in selected sources",
          citations: []
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const documentIds = bundleDocs.map(d => d.document_id);

    // Get documents and their chunks
    const { data: documents } = await supabase
      .from("documents")
      .select("*")
      .in("id", documentIds);

    const { data: chunks } = await supabase
      .from("document_chunks")
      .select("*")
      .in("document_id", documentIds)
      .order("chunk_index")
      .limit(50);

    if (!documents || documents.length === 0 || !chunks || chunks.length === 0) {
      return new Response(
        JSON.stringify({
          ok: true,
          answer: "Not found in selected sources",
          citations: []
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build evidence for the prompt
    const evidence: Array<{ citation: string; url: string; title: string; excerpt: string }> = [];
    const docMap = new Map(documents.map(d => [d.id, d]));

    for (const chunk of chunks.slice(0, 12)) {
      const doc = docMap.get(chunk.document_id);
      if (!doc) continue;

      evidence.push({
        citation: `C${evidence.length + 1}`,
        url: doc.url,
        title: doc.title,
        excerpt: chunk.content.slice(0, 900),
      });
    }

    if (evidence.length === 0) {
      return new Response(
        JSON.stringify({
          ok: true,
          answer: "Not found in selected sources",
          citations: []
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build the prompt
    const systemPrompt = `You are a helpful assistant that answers questions based ONLY on the provided evidence.
Rules:
- Use ONLY the provided evidence to answer
- If the evidence does not support an answer, respond exactly: "Not found in selected sources"
- Cite sources using brackets like [C1], [C2]
- Keep answers concise and factual
- Do not add information not present in the evidence`;

    const evidenceText = evidence
      .map(e => `${e.citation} - ${e.title}\nURL: ${e.url}\n${e.excerpt}`)
      .join("\n\n---\n\n");

    const userPrompt = `Question: ${question}

Evidence:
${evidenceText}`;

    // Call the AI gateway
    const response = await fetch(AI_GATEWAY_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 1024,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ ok: false, error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ ok: false, error: "Payment required. Please add credits." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      throw new Error(`AI Gateway error: ${response.status} - ${errorText}`);
    }

    const aiResponse = await response.json();
    const answer = aiResponse.choices?.[0]?.message?.content || "Not found in selected sources";

    return new Response(
      JSON.stringify({
        ok: true,
        answer,
        citations: evidence,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Ask error:", error);
    return new Response(
      JSON.stringify({ ok: false, error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
