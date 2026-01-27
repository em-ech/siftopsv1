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
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
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

    console.log("Starting TechCrunch sync...");
    
    // Update sync status
    await supabase.from("sync_status").upsert({ 
      id: '00000000-0000-0000-0000-000000000001',
      status: "syncing",
      error: null 
    });
    
    // Fetch just 10 posts per invocation to stay within limits
    const url = 'https://techcrunch.com/wp-json/wp/v2/posts?per_page=10&page=1';
    console.log(`Fetching: ${url}`);
    
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' }
    });
    
    if (!response.ok) {
      throw new Error(`WordPress API returned ${response.status}`);
    }
    
    const posts = await response.json();
    console.log(`Fetched ${posts.length} posts`);
    
    let docsInserted = 0;
    let chunksCreated = 0;
    
    for (const post of posts) {
      const docId = `tc_post_${post.id}`;
      const title = htmlToText(post.title?.rendered || "Untitled");
      const excerpt = htmlToText(post.excerpt?.rendered || "");
      const content = htmlToText(post.content?.rendered || "");
      const fullText = [title, excerpt, content].filter(Boolean).join("\n\n").slice(0, 3000);
      const postUrl = post.link || "";
      
      if (!postUrl || !fullText) continue;
      
      // Check if document already exists
      const { data: existing } = await supabase
        .from("documents")
        .select("id")
        .eq("doc_id", docId)
        .single();
      
      let documentId: string;
      
      if (existing) {
        documentId = existing.id;
        console.log(`Doc ${docId} exists, checking chunks...`);
      } else {
        // Insert document
        const { data: newDoc, error: docError } = await supabase
          .from("documents")
          .insert({
            doc_id: docId,
            type: "post",
            title: title.slice(0, 500),
            url: postUrl,
            full_text: fullText,
            published_at: post.date || null,
          })
          .select("id")
          .single();
        
        if (docError) {
          console.error(`Error inserting doc ${docId}:`, docError.message);
          continue;
        }
        
        documentId = newDoc.id;
        docsInserted++;
        console.log(`Inserted doc: ${docId}`);
      }
      
      // Check if chunks already exist
      const { data: existingChunks } = await supabase
        .from("document_chunks")
        .select("id")
        .eq("document_id", documentId)
        .limit(1);
      
      if (existingChunks && existingChunks.length > 0) {
        console.log(`Chunks exist for ${docId}, skipping`);
        continue;
      }
      
      // Create single chunk with embedding
      const chunkId = `${docId}::c1`;
      const chunkContent = fullText.slice(0, 800);
      
      try {
        console.log(`Generating embedding for ${docId}...`);
        const embedding = await getEmbedding(`${title} ${chunkContent}`);
        
        const { error: chunkError } = await supabase
          .from("document_chunks")
          .insert({
            chunk_id: chunkId,
            document_id: documentId,
            chunk_index: 0,
            content: chunkContent,
            embedding: embedding,
          });
        
        if (chunkError) {
          console.error(`Error inserting chunk:`, chunkError.message);
        } else {
          chunksCreated++;
          console.log(`Created chunk for ${docId}`);
        }
      } catch (embError) {
        console.error(`Embedding error:`, embError);
      }
    }

    // Get total counts
    const { count: totalDocs } = await supabase
      .from("documents")
      .select("*", { count: "exact", head: true });
    
    const { count: totalChunks } = await supabase
      .from("document_chunks")
      .select("*", { count: "exact", head: true });

    // Update sync status
    await supabase.from("sync_status").upsert({
      id: '00000000-0000-0000-0000-000000000001',
      synced_at: new Date().toISOString(),
      docs_count: totalDocs || 0,
      chunks_count: totalChunks || 0,
      status: "complete",
      error: null,
    });

    console.log(`Sync complete: ${docsInserted} new docs, ${chunksCreated} new chunks`);

    return new Response(
      JSON.stringify({
        ok: true,
        docsInserted,
        chunksCreated,
        totalDocs: totalDocs || 0,
        totalChunks: totalChunks || 0,
        message: `Synced ${docsInserted} new documents with ${chunksCreated} chunks`,
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
      await supabase.from("sync_status").upsert({
        id: '00000000-0000-0000-0000-000000000001',
        status: "error",
        error: String(error),
      });
    } catch {}

    return new Response(
      JSON.stringify({ ok: false, error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
