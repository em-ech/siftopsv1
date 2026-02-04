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

function getMimeTypeLabel(mimeType: string): 'gdoc' | 'pdf' | 'text' | 'file' {
  if (mimeType?.includes('document')) return 'gdoc';
  if (mimeType?.includes('pdf')) return 'pdf';
  if (mimeType?.includes('text')) return 'text';
  return 'file';
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query } = await req.json();

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
      .from("gdrive_chunks")
      .select("*", { count: "exact", head: true });

    if (!count || count === 0) {
      return new Response(
        JSON.stringify({ ok: true, results: [], reason: "not_indexed" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get query embedding (with caching)
    console.log("Generating embedding for query:", query);
    const queryEmbedding = await getQueryEmbedding(query);

    // Perform vector similarity search with optional user filtering
    const { data: matches, error: matchError } = await supabase.rpc("match_gdrive_chunks", {
      query_embedding: queryEmbedding,
      match_threshold: 0.2,
      match_count: 30,
      filter_user_id: userId,
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

    console.log(`Found ${matches.length} matching chunks`);

    // Group by file and get best score per file
    const bestByFile = new Map<string, any>();

    for (const match of matches) {
      const existing = bestByFile.get(match.file_id);
      if (!existing || match.similarity > existing.score) {
        bestByFile.set(match.file_id, {
          docId: match.file_id,
          type: getMimeTypeLabel(match.mime_type),
          title: match.file_name,
          url: match.web_view_link,
          snippet: match.content.slice(0, 280),
          score: match.similarity,
          mimeType: match.mime_type,
          folderPath: match.folder_path,
        });
      }
    }

    // Sort by score and limit
    const results = [...bestByFile.values()]
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);

    // Check minimum confidence threshold
    if (results.length === 0 || results[0].score < 0.22) {
      return new Response(
        JSON.stringify({ ok: true, results: [], reason: "low_confidence" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Returning ${results.length} results`);

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
