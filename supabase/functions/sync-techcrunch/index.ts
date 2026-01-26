import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

function htmlToText(html: string): string {
  return String(html || "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/p>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

async function getEmbedding(text: string): Promise<string> {
  const embedding = await embeddingModel.run(text.slice(0, 1500), {
    mean_pool: true,
    normalize: true,
  });
  const arr = Array.from(embedding as Float32Array);
  return `[${arr.join(',')}]`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Update sync status to syncing
    await supabase.from("sync_status").update({ 
      status: "syncing",
      error: null 
    }).neq("id", "00000000-0000-0000-0000-000000000000");

    console.log("Starting embedding generation for existing documents...");
    
    // Find documents that don't have any chunks yet
    const { data: docsWithoutChunks, error: queryError } = await supabase
      .from("documents")
      .select(`
        id,
        doc_id,
        title,
        full_text,
        document_chunks(id)
      `)
      .limit(3);

    if (queryError) {
      throw new Error(`Query error: ${queryError.message}`);
    }

    // Filter to only docs without chunks
    const docsToProcess = (docsWithoutChunks || []).filter(
      (doc: any) => !doc.document_chunks || doc.document_chunks.length === 0
    ).slice(0, 2); // Process max 2 per invocation

    console.log(`Found ${docsToProcess.length} documents needing embeddings`);

    let chunksProcessed = 0;

    for (const doc of docsToProcess) {
      const chunkId = `${doc.doc_id}::c1`;
      const title = htmlToText(doc.title || "");
      const fullText = htmlToText(doc.full_text || "");
      const chunkContent = fullText.slice(0, 800);
      
      try {
        console.log(`Generating embedding for ${doc.doc_id}`);
        const embedding = await getEmbedding(`${title} ${chunkContent}`);
        
        const { error: chunkError } = await supabase
          .from("document_chunks")
          .insert({
            chunk_id: chunkId,
            document_id: doc.id,
            chunk_index: 0,
            content: chunkContent,
            embedding: embedding,
          });

        if (chunkError) {
          console.error(`Error inserting chunk ${chunkId}:`, chunkError);
        } else {
          chunksProcessed++;
          console.log(`Created chunk for ${doc.doc_id}`);
        }
      } catch (embError) {
        console.error(`Error getting embedding for ${doc.doc_id}:`, embError);
      }
    }

    // Get total counts
    const { count: totalDocs } = await supabase
      .from("documents")
      .select("*", { count: "exact", head: true });
    
    const { count: totalChunks } = await supabase
      .from("document_chunks")
      .select("*", { count: "exact", head: true });

    // Check if there are more docs without chunks
    const { count: docsWithoutChunksCount } = await supabase
      .from("documents")
      .select("id, document_chunks!left(id)", { count: "exact", head: true });

    const hasMore = docsToProcess.length > 0;

    // Update sync status
    await supabase.from("sync_status").update({
      synced_at: new Date().toISOString(),
      docs_count: totalDocs || 0,
      chunks_count: totalChunks || 0,
      status: hasMore ? "partial" : "complete",
      error: null,
    }).neq("id", "00000000-0000-0000-0000-000000000000");

    return new Response(
      JSON.stringify({
        ok: true,
        processed: docsToProcess.length,
        chunks: chunksProcessed,
        totalDocs: totalDocs || 0,
        totalChunks: totalChunks || 0,
        hasMore,
        message: hasMore ? `Added ${chunksProcessed} embeddings. Click Sync again to continue.` : "All documents have embeddings!",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Sync error:", error);
    
    try {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );
      await supabase.from("sync_status").update({
        status: "error",
        error: String(error),
      }).neq("id", "00000000-0000-0000-0000-000000000000");
    } catch {}

    return new Response(
      JSON.stringify({ ok: false, error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
