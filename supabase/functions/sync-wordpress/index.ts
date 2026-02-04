import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getServiceClient } from "../_shared/supabase.ts";
import { getUserIdOptional } from "../_shared/auth.ts";
import { chunkText, htmlToText, prepareForEmbedding, CHUNK_SIZE, CHUNK_OVERLAP } from "../_shared/chunking.ts";

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

// Source configuration - WordPress sites
const SOURCES: Record<string, { name: string; baseUrl: string; posts: number; pages: number }> = {
  techcrunch: { name: "TechCrunch", baseUrl: "https://techcrunch.com", posts: 50, pages: 0 },
  mozilla: { name: "Mozilla Blog", baseUrl: "https://blog.mozilla.org", posts: 50, pages: 0 },
  wpnews: { name: "WordPress.org News", baseUrl: "https://wordpress.org/news", posts: 50, pages: 10 },
  smashing: { name: "Smashing Magazine", baseUrl: "https://www.smashingmagazine.com", posts: 50, pages: 0 },
  nasa: { name: "NASA Blogs", baseUrl: "https://blogs.nasa.gov", posts: 50, pages: 0 },
};

// Configuration
const BATCH_SIZE = 50;
const MAX_ITEMS_PER_SYNC = 100;

// Initialize the embedding model
const embeddingModel = new Supabase.ai.Session('gte-small');

async function getEmbedding(text: string): Promise<string> {
  const embedding = await embeddingModel.run(text.slice(0, 1500), {
    mean_pool: true,
    normalize: true,
  });
  const arr = Array.from(embedding as Float32Array);
  return `[${arr.join(',')}]`;
}

async function fetchWordPressPosts(baseUrl: string, limit: number, type: 'posts' | 'pages' = 'posts'): Promise<any[]> {
  const results: any[] = [];
  const perPage = Math.min(limit, BATCH_SIZE);
  let page = 1;

  while (results.length < limit) {
    try {
      const url = `${baseUrl}/wp-json/wp/v2/${type}?per_page=${perPage}&page=${page}`;
      console.log(`Fetching: ${url}`);

      const response = await fetch(url, {
        headers: { 'Accept': 'application/json', 'User-Agent': 'SiftOps/1.0' }
      });

      if (!response.ok) {
        console.log(`${type} fetch returned ${response.status} for ${baseUrl}`);
        break;
      }

      const items = await response.json();
      if (!Array.isArray(items) || items.length === 0) break;

      results.push(...items);
      if (items.length < perPage) break;
      page++;
    } catch (error) {
      console.error(`Error fetching ${type} from ${baseUrl}:`, error);
      break;
    }
  }

  return results.slice(0, limit);
}

interface Checkpoint {
  lastPage: number;
  processedCount: number;
  lastItemId?: string;
}

async function getCheckpoint(supabase: any, sourceId: string, userId: string | null): Promise<Checkpoint | null> {
  const { data } = await supabase
    .from("sync_checkpoints")
    .select("*")
    .eq("source_id", sourceId)
    .eq("user_id", userId)
    .single();

  if (data && data.status === "in_progress") {
    return {
      lastPage: data.last_page || 0,
      processedCount: data.processed_count || 0,
      lastItemId: data.last_item_id,
    };
  }

  return null;
}

async function saveCheckpoint(
  supabase: any,
  sourceId: string,
  userId: string | null,
  checkpoint: Checkpoint,
  status: string = "in_progress",
  error: string | null = null
): Promise<void> {
  await supabase
    .from("sync_checkpoints")
    .upsert({
      source_id: sourceId,
      user_id: userId,
      last_page: checkpoint.lastPage,
      last_item_id: checkpoint.lastItemId,
      processed_count: checkpoint.processedCount,
      status,
      error,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: "source_id,user_id",
    });
}

async function clearCheckpoint(supabase: any, sourceId: string, userId: string | null): Promise<void> {
  await supabase
    .from("sync_checkpoints")
    .delete()
    .eq("source_id", sourceId)
    .eq("user_id", userId);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = getServiceClient();
    const userId = await getUserIdOptional(req);

    // Parse request body for sourceId
    let sourceId = 'techcrunch';
    let resume = false;
    let reset = false;

    try {
      const body = await req.json();
      if (body.sourceId && SOURCES[body.sourceId]) {
        sourceId = body.sourceId;
      }
      resume = body.resume === true;
      reset = body.reset === true;
    } catch {
      // Default to techcrunch if no body
    }

    const source = SOURCES[sourceId];
    if (!source) {
      return new Response(
        JSON.stringify({ ok: false, error: `Unknown source: ${sourceId}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Starting sync for ${source.name} (${sourceId})... (userId: ${userId || 'anonymous'})`);

    // Check for existing checkpoint
    let checkpoint = resume ? await getCheckpoint(supabase, sourceId, userId) : null;

    if (reset) {
      await clearCheckpoint(supabase, sourceId, userId);
      checkpoint = null;
    }

    let processedCount = checkpoint?.processedCount || 0;

    // Update sync status
    await supabase.from("sync_status").upsert({
      source_id: sourceId,
      user_id: userId,
      status: "syncing",
      error: null
    }, {
      onConflict: "source_id,user_id",
    });

    // Fetch posts and pages
    const posts = await fetchWordPressPosts(source.baseUrl, source.posts, 'posts');
    const pages = source.pages > 0 ? await fetchWordPressPosts(source.baseUrl, source.pages, 'pages') : [];

    console.log(`Fetched ${posts.length} posts and ${pages.length} pages from ${source.name}`);

    const allItems = [
      ...posts.map(p => ({ ...p, itemType: 'post' })),
      ...pages.map(p => ({ ...p, itemType: 'page' })),
    ];

    let docsInserted = 0;
    let chunksCreated = 0;
    let itemsProcessed = 0;

    for (const item of allItems) {
      if (itemsProcessed >= MAX_ITEMS_PER_SYNC) break;

      const docId = `${sourceId}_${item.itemType}_${item.id}`;
      const title = htmlToText(item.title?.rendered || "Untitled");
      const excerpt = htmlToText(item.excerpt?.rendered || "");
      const content = htmlToText(item.content?.rendered || "");
      const fullText = [title, excerpt, content].filter(Boolean).join("\n\n").slice(0, 10000);
      const itemUrl = item.link || "";

      if (!itemUrl || !fullText || fullText.length < 50) continue;

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
        // Insert document with source_id and user_id
        const { data: newDoc, error: docError } = await supabase
          .from("documents")
          .insert({
            doc_id: docId,
            source_id: sourceId,
            user_id: userId,
            type: item.itemType,
            title: title.slice(0, 500),
            url: itemUrl,
            full_text: fullText,
            published_at: item.date || null,
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
        processedCount++;
        itemsProcessed++;
        continue;
      }

      // Create chunks using standardized chunking
      const chunks = chunkText(fullText, CHUNK_SIZE, CHUNK_OVERLAP);

      for (let i = 0; i < chunks.length; i++) {
        const chunkId = `${docId}::c${i + 1}`;
        const chunkContent = chunks[i];

        try {
          console.log(`Generating embedding for chunk ${i + 1}/${chunks.length} of ${docId}...`);
          const textForEmbedding = prepareForEmbedding(title, chunkContent);
          const embedding = await getEmbedding(textForEmbedding);

          const { error: chunkError } = await supabase
            .from("document_chunks")
            .insert({
              chunk_id: chunkId,
              document_id: documentId,
              chunk_index: i,
              content: chunkContent,
              embedding: embedding,
            });

          if (chunkError) {
            console.error(`Error inserting chunk:`, chunkError.message);
          } else {
            chunksCreated++;
          }
        } catch (embError) {
          console.error(`Embedding error:`, embError);
        }
      }

      processedCount++;
      itemsProcessed++;

      // Save checkpoint periodically
      if (processedCount % 10 === 0) {
        await saveCheckpoint(supabase, sourceId, userId, {
          lastPage: 1,
          processedCount,
          lastItemId: docId,
        });
      }
    }

    // Get total counts
    const { count: totalDocs } = await supabase
      .from("documents")
      .select("*", { count: "exact", head: true })
      .eq("source_id", sourceId);

    const { count: totalChunks } = await supabase
      .from("document_chunks")
      .select("*", { count: "exact", head: true });

    const hasMore = itemsProcessed >= MAX_ITEMS_PER_SYNC && allItems.length > itemsProcessed;

    // Update sync status
    await supabase.from("sync_status").upsert({
      source_id: sourceId,
      user_id: userId,
      synced_at: new Date().toISOString(),
      docs_count: totalDocs || 0,
      chunks_count: totalChunks || 0,
      status: hasMore ? "partial" : "complete",
      error: null,
    }, {
      onConflict: "source_id,user_id",
    });

    // Update source status
    await supabase.from("sources").upsert({
      source_id: sourceId,
      name: source.name,
      base_url: source.baseUrl,
      status: hasMore ? "partial" : "indexed",
      docs_count: totalDocs || 0,
      user_id: userId,
    }, {
      onConflict: "source_id",
    });

    // Clear checkpoint on success
    if (!hasMore) {
      await clearCheckpoint(supabase, sourceId, userId);
    } else {
      await saveCheckpoint(supabase, sourceId, userId, {
        lastPage: 1,
        processedCount,
      }, "partial");
    }

    console.log(`Sync complete for ${source.name}: ${docsInserted} new docs, ${chunksCreated} new chunks`);

    return new Response(
      JSON.stringify({
        ok: true,
        sourceId,
        sourceName: source.name,
        docsInserted,
        chunksCreated,
        totalDocs: totalDocs || 0,
        totalChunks: totalChunks || 0,
        processedCount,
        hasMore,
        message: `Synced ${docsInserted} new documents with ${chunksCreated} chunks from ${source.name}`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Sync error:", error);

    try {
      const supabase = getServiceClient();
      const userId = await getUserIdOptional(req).catch(() => null);

      await supabase.from("sync_status").upsert({
        source_id: 'techcrunch',
        user_id: userId,
        status: "error",
        error: String(error),
      }, {
        onConflict: "source_id,user_id",
      });
    } catch {}

    return new Response(
      JSON.stringify({ ok: false, error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
