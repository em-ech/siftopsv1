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

function chunkText(text: string, maxChars = 800): string[] {
  const t = String(text || "").replace(/\s+/g, " ").trim();
  if (!t) return [];
  
  // Simple chunking without overlap for speed
  const chunks: string[] = [];
  for (let i = 0; i < t.length; i += maxChars) {
    chunks.push(t.slice(i, i + maxChars));
  }
  
  // Limit to first 2 chunks per document for speed
  return chunks.slice(0, 2);
}

async function getEmbedding(text: string): Promise<number[]> {
  const embedding = await embeddingModel.run(text.slice(0, 2000), {
    mean_pool: true,
    normalize: true,
  });
  return Array.from(embedding as Float32Array);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Update sync status
    await supabase.from("sync_status").update({ status: "syncing" }).neq("id", "00000000-0000-0000-0000-000000000000");

    console.log("Starting TechCrunch sync (limited)...");
    
    // Fetch just 10 posts for a quick demo
    const url = `${TECHCRUNCH_API}/posts?per_page=10&page=1`;
    console.log(`Fetching ${url}`);
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch posts: ${response.status}`);
    }

    const posts = await response.json();
    console.log(`Fetched ${posts.length} posts`);

    let docsProcessed = 0;
    let chunksProcessed = 0;

    for (const item of posts) {
      const docId = `tc_post_${item.id}`;
      const title = htmlToText(item.title?.rendered || "");
      const body = htmlToText(item.content?.rendered || "");
      const excerpt = htmlToText(item.excerpt?.rendered || "");
      const fullText = [title, excerpt, body].filter(Boolean).join(" ");

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

      // Delete old chunks
      await supabase.from("document_chunks").delete().eq("document_id", doc.id);

      // Create chunks with embeddings (limited)
      const textChunks = chunkText(fullText, 800);
      
      for (let i = 0; i < textChunks.length; i++) {
        const chunkId = `${docId}::c${i + 1}`;
        const chunkContent = textChunks[i];
        
        try {
          const embedding = await getEmbedding(`${title} ${chunkContent}`);
          
          const { error: chunkError } = await supabase
            .from("document_chunks")
            .insert({
              chunk_id: chunkId,
              document_id: doc.id,
              chunk_index: i,
              content: chunkContent,
              embedding: JSON.stringify(embedding),
            });

          if (chunkError) {
            console.error(`Error inserting chunk ${chunkId}:`, chunkError);
          } else {
            chunksProcessed++;
          }
        } catch (embError) {
          console.error(`Error getting embedding for chunk ${chunkId}:`, embError);
        }
      }

      docsProcessed++;
      console.log(`Processed ${docsProcessed}/${posts.length} documents, ${chunksProcessed} chunks`);
    }

    // Update sync status
    await supabase.from("sync_status").update({
      synced_at: new Date().toISOString(),
      docs_count: docsProcessed,
      chunks_count: chunksProcessed,
      status: "complete",
      error: null,
    }).neq("id", "00000000-0000-0000-0000-000000000000");

    return new Response(
      JSON.stringify({
        ok: true,
        docs: docsProcessed,
        chunks: chunksProcessed,
        syncedAt: new Date().toISOString(),
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
