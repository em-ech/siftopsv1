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

// Configuration
const SOURCE_ID = "techcrunch";
const SOURCE_NAME = "TechCrunch";
const BASE_URL = "https://techcrunch.com";
const BATCH_SIZE = 50; // Increased from 10
const MAX_ITEMS_PER_SYNC = 200;

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

    // Parse request body for options
    let resumeFromCheckpoint = false;
    let forceReset = false;
    try {
      const body = await req.json();
      resumeFromCheckpoint = body.resume === true;
      forceReset = body.reset === true;
    } catch {
      // No body or invalid JSON - use defaults
    }

    console.log(`Starting TechCrunch sync... (userId: ${userId || 'anonymous'})`);

    // Check for existing checkpoint
    let checkpoint = resumeFromCheckpoint ? await getCheckpoint(supabase, SOURCE_ID, userId) : null;

    if (forceReset) {
      await clearCheckpoint(supabase, SOURCE_ID, userId);
      checkpoint = null;
    }

    const startPage = checkpoint?.lastPage || 1;
    let processedCount = checkpoint?.processedCount || 0;

    // Update sync status to syncing
    await supabase.from("sync_status").upsert({
      source_id: SOURCE_ID,
      user_id: userId,
      status: "syncing",
      error: null,
    }, {
      onConflict: "source_id,user_id",
    });

    let currentPage = startPage;
    let totalFetched = 0;
    let docsInserted = 0;
    let chunksCreated = 0;
    let hasMore = true;

    // Fetch posts in batches
    while (hasMore && totalFetched < MAX_ITEMS_PER_SYNC) {
      const url = `${BASE_URL}/wp-json/wp/v2/posts?per_page=${BATCH_SIZE}&page=${currentPage}`;
      console.log(`Fetching page ${currentPage}: ${url}`);

      const response = await fetch(url, {
        headers: { 'Accept': 'application/json' }
      });

      if (!response.ok) {
        if (response.status === 400) {
          // No more pages
          hasMore = false;
          break;
        }
        throw new Error(`WordPress API returned ${response.status}`);
      }

      const posts = await response.json();

      if (!Array.isArray(posts) || posts.length === 0) {
        hasMore = false;
        break;
      }

      console.log(`Processing ${posts.length} posts from page ${currentPage}`);

      for (const post of posts) {
        const docId = `tc_post_${post.id}`;
        const title = htmlToText(post.title?.rendered || "Untitled");
        const excerpt = htmlToText(post.excerpt?.rendered || "");
        const content = htmlToText(post.content?.rendered || "");
        const fullText = [title, excerpt, content].filter(Boolean).join("\n\n").slice(0, 10000);
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
          // Insert document with source_id and user_id
          const { data: newDoc, error: docError } = await supabase
            .from("documents")
            .insert({
              doc_id: docId,
              source_id: SOURCE_ID,
              user_id: userId,
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
          processedCount++;
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
        totalFetched++;

        // Save checkpoint periodically
        if (processedCount % 10 === 0) {
          await saveCheckpoint(supabase, SOURCE_ID, userId, {
            lastPage: currentPage,
            processedCount,
            lastItemId: docId,
          });
        }
      }

      // Check total pages header
      const totalPagesHeader = response.headers.get("x-wp-totalpages");
      const totalPages = totalPagesHeader ? parseInt(totalPagesHeader, 10) : null;

      if (posts.length < BATCH_SIZE || (totalPages && currentPage >= totalPages)) {
        hasMore = false;
      } else {
        currentPage++;
      }
    }

    // Get total counts
    const { count: totalDocs } = await supabase
      .from("documents")
      .select("*", { count: "exact", head: true })
      .eq("source_id", SOURCE_ID);

    const { count: totalChunks } = await supabase
      .from("document_chunks")
      .select("*", { count: "exact", head: true });

    // Update sync status
    await supabase.from("sync_status").upsert({
      source_id: SOURCE_ID,
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
      source_id: SOURCE_ID,
      name: SOURCE_NAME,
      base_url: BASE_URL,
      status: hasMore ? "partial" : "indexed",
      docs_count: totalDocs || 0,
      user_id: userId,
    }, {
      onConflict: "source_id",
    });

    // Clear checkpoint on success if fully complete
    if (!hasMore) {
      await clearCheckpoint(supabase, SOURCE_ID, userId);
    } else {
      // Save final checkpoint for resume
      await saveCheckpoint(supabase, SOURCE_ID, userId, {
        lastPage: currentPage,
        processedCount,
      }, "partial");
    }

    console.log(`Sync complete: ${docsInserted} new docs, ${chunksCreated} new chunks, hasMore: ${hasMore}`);

    return new Response(
      JSON.stringify({
        ok: true,
        sourceId: SOURCE_ID,
        docsInserted,
        chunksCreated,
        totalDocs: totalDocs || 0,
        totalChunks: totalChunks || 0,
        processedCount,
        hasMore,
        nextPage: hasMore ? currentPage : null,
        message: `Synced ${docsInserted} new documents with ${chunksCreated} chunks`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Sync error:", error);

    // Save error to checkpoint for debugging
    try {
      const supabase = getServiceClient();
      const userId = await getUserIdOptional(req).catch(() => null);

      await supabase.from("sync_status").upsert({
        source_id: SOURCE_ID,
        user_id: userId,
        status: "error",
        error: String(error),
      }, {
        onConflict: "source_id,user_id",
      });

      // Keep checkpoint for potential resume
      await saveCheckpoint(supabase, SOURCE_ID, userId, {
        lastPage: 1,
        processedCount: 0,
      }, "error", String(error));
    } catch {}

    return new Response(
      JSON.stringify({ ok: false, error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
