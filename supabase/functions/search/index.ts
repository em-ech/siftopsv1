import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getServiceClient } from "../_shared/supabase.ts";
import { getUserIdOptional } from "../_shared/auth.ts";
import { getFromMemoryCache, setInMemoryCache, normalizeQuery } from "../_shared/cache.ts";

// Declare Supabase AI global
declare const Supabase: {
  ai: {
    Session: new (model: string) => {
      run: (input: string, options?: { mean_pool?: boolean; normalize?: boolean }) => Promise<Float32Array>;
    };
  };
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Initialize the embedding model
const embeddingModel = new Supabase.ai.Session('gte-small');

async function getEmbedding(text: string): Promise<string> {
  const embedding = await embeddingModel.run(text.slice(0, 2000), {
    mean_pool: true,
    normalize: true,
  });
  const arr = Array.from(embedding as Float32Array);
  return `[${arr.join(',')}]`;
}

async function getQueryEmbedding(query: string): Promise<string> {
  const normalizedQuery = normalizeQuery(query);

  // Check cache first
  const cached = getFromMemoryCache(normalizedQuery);
  if (cached) {
    console.log("Cache hit for query:", normalizedQuery.slice(0, 50));
    return cached;
  }

  // Generate new embedding
  console.log("Cache miss, generating embedding for:", normalizedQuery.slice(0, 50));
  const embedding = await getEmbedding(normalizedQuery);

  // Store in cache
  setInMemoryCache(normalizedQuery, embedding);

  return embedding;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, sourceId } = await req.json();

    if (!query || typeof query !== "string" || !query.trim()) {
      return new Response(
        JSON.stringify({ ok: true, results: [], reason: "empty_query" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = getServiceClient();
    const userId = await getUserIdOptional(req);

    // Check if we have any indexed content
    const { count } = await supabase
      .from("document_chunks")
      .select("*", { count: "exact", head: true });

    if (!count || count === 0) {
      return new Response(
        JSON.stringify({ ok: true, results: [], reason: "not_indexed" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get query embedding (with caching)
    const queryEmbedding = await getQueryEmbedding(query);

    // Perform vector similarity search with optional user/source filtering
    const { data: matches, error: matchError } = await supabase.rpc("match_chunks", {
      query_embedding: queryEmbedding,
      match_threshold: 0.2,
      match_count: 30,
      filter_user_id: userId,
      filter_source_id: sourceId || null,
    });

    if (matchError) {
      console.error("Match error:", matchError);
      throw matchError;
    }

    if (!matches || matches.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, results: [], reason: "no_matches" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get feedback weights for reranking
    const querySig = normalizeQuery(query);
    const docIds = [...new Set(matches.map((m: any) => m.doc_id))];

    const { data: feedbackData } = await supabase
      .from("feedback")
      .select("doc_id, weight")
      .eq("query_signature", querySig)
      .in("doc_id", docIds);

    const feedbackMap = new Map<string, number>();
    if (feedbackData) {
      for (const fb of feedbackData) {
        feedbackMap.set(fb.doc_id, fb.weight || 0);
      }
    }

    // Group by document and get best score per doc
    const bestByDoc = new Map<string, any>();

    for (const match of matches) {
      const boost = feedbackMap.get(match.doc_id) || 0;
      const finalScore = match.similarity + boost * 0.02;

      const existing = bestByDoc.get(match.doc_id);
      if (!existing || finalScore > existing.score) {
        bestByDoc.set(match.doc_id, {
          docId: match.doc_id,
          type: match.type,
          title: match.title,
          url: match.url,
          snippet: match.content.slice(0, 280),
          score: finalScore,
        });
      }
    }

    // Sort by score and limit
    const results = [...bestByDoc.values()]
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);

    // Check minimum confidence threshold
    if (results.length === 0 || results[0].score < 0.22) {
      return new Response(
        JSON.stringify({ ok: true, results: [], reason: "low_confidence" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ ok: true, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Search error:", error);
    return new Response(
      JSON.stringify({ ok: false, error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
