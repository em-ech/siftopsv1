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

const TECHCRUNCH_API = "https://techcrunch.com/wp-json/wp/v2";

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

    // Get current sync progress
    const { data: statusData } = await supabase
      .from("sync_status")
      .select("*")
      .limit(1)
      .single();

    const currentPage = statusData?.docs_count ? Math.floor(statusData.docs_count / 5) + 1 : 1;
    const offset = statusData?.docs_count || 0;

    // Update sync status to syncing
    await supabase.from("sync_status").update({ 
      status: "syncing",
      error: null 
    }).neq("id", "00000000-0000-0000-0000-000000000000");

    console.log(`Starting incremental sync, offset: ${offset}`);
    
    // Fetch only 5 posts at a time to stay under CPU limits
    const url = `${TECHCRUNCH_API}/posts?per_page=5&page=${currentPage}`;
    console.log(`Fetching ${url}`);
    
    const response = await fetch(url);
    if (!response.ok) {
      if (response.status === 400) {
        // No more pages
        await supabase.from("sync_status").update({
          status: "complete",
          error: null,
        }).neq("id", "00000000-0000-0000-0000-000000000000");
        
        return new Response(
          JSON.stringify({ ok: true, message: "Sync complete - no more posts" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error(`Failed to fetch posts: ${response.status}`);
    }

    const posts = await response.json();
    console.log(`Fetched ${posts.length} posts`);

    if (posts.length === 0) {
      await supabase.from("sync_status").update({
        status: "complete",
        error: null,
      }).neq("id", "00000000-0000-0000-0000-000000000000");
      
      return new Response(
        JSON.stringify({ ok: true, message: "Sync complete" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let docsProcessed = 0;
    let chunksProcessed = 0;

    // Process only first 2 posts per invocation to stay under CPU limit
    const postsToProcess = posts.slice(0, 2);

    for (const item of postsToProcess) {
      const docId = `tc_post_${item.id}`;
      const title = htmlToText(item.title?.rendered || "");
      const body = htmlToText(item.content?.rendered || "");
      const excerpt = htmlToText(item.excerpt?.rendered || "");
      
      // Keep text shorter to reduce embedding time
      const fullText = [title, excerpt, body.slice(0, 1000)].filter(Boolean).join(" ");

      // Upsert document
      const { data: doc, error: docError } = await supabase
        .from("documents")
        .upsert({
          doc_id: docId,
          type: "post",
          title,
          url: item.link || "",
          published_at: item.date || null,
          full_text: fullText,
        }, { onConflict: "doc_id" })
        .select()
        .single();

      if (docError) {
        console.error(`Error upserting document ${docId}:`, docError);
        continue;
      }

      // Check if chunks already exist for this document
      const { count: existingChunks } = await supabase
        .from("document_chunks")
        .select("*", { count: "exact", head: true })
        .eq("document_id", doc.id);

      if (existingChunks && existingChunks > 0) {
        console.log(`Skipping ${docId} - already has chunks`);
        docsProcessed++;
        continue;
      }

      // Create just 1 chunk per document to minimize CPU usage
      const chunkId = `${docId}::c1`;
      const chunkContent = fullText.slice(0, 800);
      
      try {
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
        }
      } catch (embError) {
        console.error(`Error getting embedding for chunk ${chunkId}:`, embError);
      }

      docsProcessed++;
      console.log(`Processed doc ${docsProcessed}/${postsToProcess.length}`);
    }

    // Get total counts
    const { count: totalDocs } = await supabase
      .from("documents")
      .select("*", { count: "exact", head: true });
    
    const { count: totalChunks } = await supabase
      .from("document_chunks")
      .select("*", { count: "exact", head: true });

    // Update sync status - keep as syncing if more posts available
    const hasMore = posts.length === 5;
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
        processed: docsProcessed,
        chunks: chunksProcessed,
        totalDocs: totalDocs || 0,
        totalChunks: totalChunks || 0,
        hasMore,
        message: hasMore ? "Click Sync again to continue" : "Sync complete",
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
