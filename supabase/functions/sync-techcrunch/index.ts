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

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

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

function chunkText(text: string, maxChars = 1200, overlap = 200): string[] {
  const t = String(text || "").replace(/\s+/g, " ").trim();
  if (!t) return [];
  
  const chunks: string[] = [];
  let start = 0;
  
  while (start < t.length) {
    const end = Math.min(start + maxChars, t.length);
    chunks.push(t.slice(start, end));
    start = end - overlap;
    if (start >= t.length - overlap) break;
  }
  
  return chunks;
}

async function getEmbedding(text: string): Promise<number[]> {
  const embedding = await embeddingModel.run(text.slice(0, 4000), {
    mean_pool: true,
    normalize: true,
  });
  return Array.from(embedding as Float32Array);
}

async function fetchAllFromEndpoint(endpoint: string): Promise<any[]> {
  const all: any[] = [];
  let page = 1;
  const perPage = 20;
  const maxPages = 3; // Limit to 60 items for faster sync

  while (page <= maxPages) {
    const url = `${TECHCRUNCH_API}/${endpoint}?per_page=${perPage}&page=${page}`;
    console.log(`Fetching ${url}`);
    
    const response = await fetch(url);
    if (!response.ok) break;

    const items = await response.json();
    if (!Array.isArray(items) || items.length === 0) break;

    all.push(...items);
    page++;
    await sleep(150);
  }

  return all;
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

    console.log("Starting TechCrunch sync...");
    
    // Fetch posts and pages
    const [posts, pages] = await Promise.all([
      fetchAllFromEndpoint("posts"),
      fetchAllFromEndpoint("pages"),
    ]);

    console.log(`Fetched ${posts.length} posts and ${pages.length} pages`);

    const allItems = [
      ...posts.map(p => ({ ...p, itemType: "post" })),
      ...pages.map(p => ({ ...p, itemType: "page" })),
    ];

    let docsProcessed = 0;
    let chunksProcessed = 0;

    for (const item of allItems) {
      const docId = `tc_${item.itemType}_${item.id}`;
      const title = htmlToText(item.title?.rendered || "");
      const body = htmlToText(item.content?.rendered || "");
      const excerpt = htmlToText(item.excerpt?.rendered || "");
      const fullText = [title, excerpt, body].filter(Boolean).join("\n\n");

      // Upsert document
      const { data: doc, error: docError } = await supabase
        .from("documents")
        .upsert({
          doc_id: docId,
          type: item.itemType,
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

      // Delete old chunks for this document
      await supabase.from("document_chunks").delete().eq("document_id", doc.id);

      // Create new chunks with embeddings
      const textChunks = chunkText(fullText, 1200, 200);
      
      for (let i = 0; i < textChunks.length; i++) {
        const chunkId = `${docId}::c${i + 1}`;
        const chunkContent = textChunks[i];
        
        try {
          const embedding = await getEmbedding(`${title}\n\n${chunkContent}`);
          
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
      console.log(`Processed ${docsProcessed}/${allItems.length} documents`);
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
    
    // Try to update sync status with error
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
