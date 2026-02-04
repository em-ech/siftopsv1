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
    const { bundleId, question } = await req.json();

    if (!bundleId || !question) {
      return new Response(
        JSON.stringify({ ok: false, error: "Missing bundleId or question" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = getServiceClient();
    const userId = await getUserIdOptional(req);
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    if (!lovableApiKey) {
      return new Response(
        JSON.stringify({ ok: false, error: "AI service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get bundle and verify it's locked (with user filtering)
    let bundleQuery = supabase
      .from("bundles")
      .select("*")
      .eq("bundle_id", bundleId);

    if (userId) {
      bundleQuery = bundleQuery.or(`user_id.eq.${userId},user_id.is.null`);
    }

    const { data: bundleData, error: bundleError } = await bundleQuery.single();

    if (bundleError || !bundleData) {
      return new Response(
        JSON.stringify({ ok: false, error: "Bundle not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!bundleData.locked) {
      return new Response(
        JSON.stringify({ ok: false, error: "Bundle must be locked to ask questions" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get bundle documents (these are file IDs for Google Drive)
    const { data: bundleDocs } = await supabase
      .from("bundle_documents")
      .select("document_id")
      .eq("bundle_id", bundleData.id);

    const docIds = bundleDocs?.map(d => d.document_id) || [];

    if (docIds.length === 0) {
      return new Response(
        JSON.stringify({
          ok: true,
          answer: "No sources in the bundle. Add sources from search results first.",
          citations: [],
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch content from Google Drive files (with user filtering)
    let gdriveQuery = supabase
      .from("gdrive_files")
      .select("file_id, name, web_view_link, full_text")
      .in("file_id", docIds);

    if (userId) {
      gdriveQuery = gdriveQuery.or(`user_id.eq.${userId},user_id.is.null`);
    }

    const { data: gdriveFiles } = await gdriveQuery;

    // Also check regular documents (for WordPress sources)
    const { data: wpDocs } = await supabase
      .from("documents")
      .select("doc_id, title, url, full_text")
      .in("doc_id", docIds);

    // Combine sources
    interface SourceDoc {
      id: string;
      title: string;
      url: string;
      content: string;
    }

    const sources: SourceDoc[] = [];

    if (gdriveFiles) {
      for (const file of gdriveFiles) {
        sources.push({
          id: file.file_id,
          title: file.name,
          url: file.web_view_link,
          content: file.full_text?.slice(0, 3000) || "",
        });
      }
    }

    if (wpDocs) {
      for (const doc of wpDocs) {
        sources.push({
          id: doc.doc_id,
          title: doc.title,
          url: doc.url,
          content: doc.full_text?.slice(0, 3000) || "",
        });
      }
    }

    if (sources.length === 0) {
      return new Response(
        JSON.stringify({
          ok: true,
          answer: "Could not find content for the selected sources.",
          citations: [],
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build context for LLM
    const sourceContext = sources
      .map((s, i) => `[C${i + 1}] ${s.title}\n${s.content}`)
      .join("\n\n---\n\n");

    const systemPrompt = `You are a helpful research assistant. Answer the user's question using ONLY the provided sources.

RULES:
1. Use ONLY information from the provided sources
2. Cite every claim with [C1], [C2], etc. matching the source numbers
3. If the information is not in the sources, say "I can't answer that from the selected sources."
4. Be concise and accurate
5. Do not make up or infer information not explicitly stated

SOURCES:
${sourceContext}`;

    // Call Lovable AI
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: question },
        ],
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI error:", response.status, errorText);

      if (response.status === 429) {
        return new Response(
          JSON.stringify({ ok: false, error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ ok: false, error: "AI credits exhausted. Please add credits." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      throw new Error(`AI request failed: ${response.status}`);
    }

    const aiResult = await response.json();
    const answer = aiResult.choices?.[0]?.message?.content || "No response generated";

    // Extract citations from answer
    const citationMatches = answer.match(/\[C\d+\]/g) || [];
    const usedCitations = [...new Set(citationMatches)] as string[];

    const citations = usedCitations.map((citation: string) => {
      const num = parseInt(citation.replace(/\[C|\]/g, ""), 10);
      const source = sources[num - 1];
      return source
        ? {
            citation,
            url: source.url,
            title: source.title,
            excerpt: source.content.slice(0, 200),
          }
        : null;
    }).filter(Boolean);

    console.log(`Generated answer with ${citations.length} citations`);

    return new Response(
      JSON.stringify({
        ok: true,
        answer,
        citations,
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
