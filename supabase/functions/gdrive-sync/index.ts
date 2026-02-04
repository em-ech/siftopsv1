import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getServiceClient } from "../_shared/supabase.ts";
import { getUserIdOptional } from "../_shared/auth.ts";
import { chunkText, prepareForEmbedding, CHUNK_SIZE, CHUNK_OVERLAP } from "../_shared/chunking.ts";

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
const BATCH_SIZE = 50;
const MAX_CHUNKS_PER_FILE = 10;

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

// Refresh access token if needed
async function refreshTokenIfNeeded(
  supabase: any,
  connection: any
): Promise<string> {
  const now = new Date();
  const expiresAt = connection.token_expires_at ? new Date(connection.token_expires_at) : null;

  // If token is still valid for at least 5 minutes, use it
  if (expiresAt && expiresAt.getTime() - now.getTime() > 5 * 60 * 1000) {
    return connection.access_token;
  }

  // Need to refresh
  if (!connection.refresh_token) {
    throw new Error("No refresh token available");
  }

  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");

  if (!clientId || !clientSecret) {
    throw new Error("Google OAuth not configured");
  }

  console.log("Refreshing access token...");
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: connection.refresh_token,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Token refresh failed:", errorText);
    throw new Error("Failed to refresh access token");
  }

  const tokens = await response.json();
  const newExpiresAt = tokens.expires_in
    ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
    : null;

  // Update stored tokens
  await supabase
    .from("gdrive_connections")
    .update({
      access_token: tokens.access_token,
      token_expires_at: newExpiresAt,
    })
    .eq("id", connection.id);

  return tokens.access_token;
}

// Fetch file list from Google Drive
async function fetchDriveFiles(accessToken: string, folderId?: string, pageToken?: string): Promise<{ files: any[]; nextPageToken: string | null }> {
  // File types we can extract text from
  const mimeTypes = [
    "application/vnd.google-apps.document",
    "application/pdf",
    "text/plain",
    "application/vnd.google-apps.spreadsheet",
    "application/vnd.google-apps.presentation",
  ];

  const mimeQuery = mimeTypes.map(m => `mimeType='${m}'`).join(" or ");
  let query = `(${mimeQuery}) and trashed=false`;

  if (folderId) {
    query = `'${folderId}' in parents and ${query}`;
  }

  const url = new URL("https://www.googleapis.com/drive/v3/files");
  url.searchParams.set("q", query);
  url.searchParams.set("fields", "nextPageToken,files(id,name,mimeType,webViewLink,modifiedTime,parents)");
  url.searchParams.set("pageSize", String(BATCH_SIZE));
  if (pageToken) {
    url.searchParams.set("pageToken", pageToken);
  }

  const response = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Drive API error:", errorText);
    throw new Error("Failed to fetch files from Google Drive");
  }

  const data = await response.json();
  return {
    files: data.files || [],
    nextPageToken: data.nextPageToken || null,
  };
}

// Get folder path for a file
async function getFolderPath(accessToken: string, parentIds: string[]): Promise<string> {
  if (!parentIds || parentIds.length === 0) return "";

  try {
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${parentIds[0]}?fields=name`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (response.ok) {
      const folder = await response.json();
      return folder.name || "";
    }
  } catch (e) {
    console.error("Error getting folder path:", e);
  }

  return "";
}

// Export Google Doc content as plain text
async function exportGoogleDoc(accessToken: string, fileId: string): Promise<string> {
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=text/plain`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!response.ok) {
    console.error("Failed to export Google Doc:", fileId);
    return "";
  }

  return await response.text();
}

// Get file content for non-Google formats
async function getFileContent(accessToken: string, fileId: string, mimeType: string): Promise<string> {
  if (mimeType === "text/plain") {
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (response.ok) {
      return await response.text();
    }
  }

  // For PDFs, return placeholder - full PDF extraction would require a PDF library
  if (mimeType === "application/pdf") {
    return `[PDF content from file ${fileId} - PDF text extraction not yet implemented]`;
  }

  // For Sheets/Slides, export as plain text
  if (mimeType.includes("spreadsheet") || mimeType.includes("presentation")) {
    try {
      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=text/plain`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (response.ok) {
        return await response.text();
      }
    } catch (e) {
      console.error("Failed to export file:", fileId, e);
    }
  }

  return "";
}

interface SyncCheckpoint {
  pageToken: string | null;
  processedFiles: number;
  totalChunks: number;
}

async function getCheckpoint(supabase: any, connectionId: string, userId: string | null): Promise<SyncCheckpoint | null> {
  const { data } = await supabase
    .from("sync_checkpoints")
    .select("*")
    .eq("source_id", `gdrive_${connectionId}`)
    .eq("user_id", userId)
    .single();

  if (data && data.status === "in_progress") {
    return {
      pageToken: data.last_item_id,
      processedFiles: data.processed_count || 0,
      totalChunks: data.total_count || 0,
    };
  }

  return null;
}

async function saveCheckpoint(
  supabase: any,
  connectionId: string,
  userId: string | null,
  checkpoint: SyncCheckpoint,
  status: string = "in_progress",
  error: string | null = null
): Promise<void> {
  await supabase
    .from("sync_checkpoints")
    .upsert({
      source_id: `gdrive_${connectionId}`,
      user_id: userId,
      last_item_id: checkpoint.pageToken,
      processed_count: checkpoint.processedFiles,
      total_count: checkpoint.totalChunks,
      status,
      error,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: "source_id,user_id",
    });
}

async function clearCheckpoint(supabase: any, connectionId: string, userId: string | null): Promise<void> {
  await supabase
    .from("sync_checkpoints")
    .delete()
    .eq("source_id", `gdrive_${connectionId}`)
    .eq("user_id", userId);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { connectionId, folderId, resume, reset } = await req.json();

    const supabase = getServiceClient();
    const userId = await getUserIdOptional(req);

    // Get connection
    const { data: connection, error: connError } = await supabase
      .from("gdrive_connections")
      .select("*")
      .eq("id", connectionId)
      .single();

    if (connError || !connection) {
      throw new Error("Connection not found");
    }

    // Get valid access token
    const accessToken = await refreshTokenIfNeeded(supabase, connection);

    // Check for checkpoint
    let checkpoint = resume ? await getCheckpoint(supabase, connectionId, userId) : null;

    if (reset) {
      await clearCheckpoint(supabase, connectionId, userId);
      checkpoint = null;
    }

    // Update sync status to indexing
    await supabase
      .from("gdrive_sync_status")
      .update({ status: "indexing", error: null })
      .eq("connection_id", connectionId);

    console.log("Fetching files from Google Drive...");

    let pageToken = checkpoint?.pageToken || undefined;
    let totalFiles = checkpoint?.processedFiles || 0;
    let totalChunks = checkpoint?.totalChunks || 0;
    let hasMore = true;
    let filesProcessedThisBatch = 0;

    while (hasMore) {
      const { files: driveFiles, nextPageToken } = await fetchDriveFiles(accessToken, folderId, pageToken);
      console.log(`Fetched ${driveFiles.length} files`);

      for (const file of driveFiles) {
        console.log(`Processing: ${file.name} (${file.mimeType})`);

        // Get file content based on type
        let content = "";
        if (file.mimeType === "application/vnd.google-apps.document") {
          content = await exportGoogleDoc(accessToken, file.id);
        } else {
          content = await getFileContent(accessToken, file.id, file.mimeType);
        }

        if (!content || content.length < 50) {
          console.log(`Skipping ${file.name} - no content or too short`);
          continue;
        }

        // Get folder path
        const folderPath = await getFolderPath(accessToken, file.parents);

        // Check if file already exists
        const { data: existingFile } = await supabase
          .from("gdrive_files")
          .select("id")
          .eq("connection_id", connectionId)
          .eq("file_id", file.id)
          .single();

        let fileRecordId: string;

        if (existingFile) {
          fileRecordId = existingFile.id;
          // Update file content
          await supabase
            .from("gdrive_files")
            .update({
              name: file.name,
              mime_type: file.mimeType,
              web_view_link: file.webViewLink,
              folder_path: folderPath || null,
              full_text: content.slice(0, 50000),
              modified_time: file.modifiedTime,
              indexed_at: new Date().toISOString(),
              user_id: userId,
            })
            .eq("id", existingFile.id);

          // Delete existing chunks to recreate
          await supabase
            .from("gdrive_chunks")
            .delete()
            .eq("file_id", existingFile.id);
        } else {
          // Insert file record
          const { data: fileRecord, error: fileError } = await supabase
            .from("gdrive_files")
            .insert({
              connection_id: connectionId,
              file_id: file.id,
              name: file.name,
              mime_type: file.mimeType,
              web_view_link: file.webViewLink,
              folder_path: folderPath || null,
              full_text: content.slice(0, 50000),
              modified_time: file.modifiedTime,
              indexed_at: new Date().toISOString(),
              user_id: userId,
            })
            .select()
            .single();

          if (fileError) {
            console.error(`Error inserting file ${file.name}:`, fileError);
            continue;
          }

          fileRecordId = fileRecord.id;
        }

        totalFiles++;

        // Chunk and embed content using standardized chunking
        const chunks = chunkText(content, CHUNK_SIZE, CHUNK_OVERLAP);

        for (let i = 0; i < Math.min(chunks.length, MAX_CHUNKS_PER_FILE); i++) {
          const chunkId = `${file.id}::c${i + 1}`;
          const chunkContent = chunks[i];

          try {
            console.log(`Embedding chunk ${i + 1}/${Math.min(chunks.length, MAX_CHUNKS_PER_FILE)} for ${file.name}`);
            const textForEmbedding = prepareForEmbedding(file.name, chunkContent);
            const embedding = await getEmbedding(textForEmbedding);

            const { error: chunkError } = await supabase
              .from("gdrive_chunks")
              .insert({
                file_id: fileRecordId,
                chunk_id: chunkId,
                chunk_index: i,
                content: chunkContent,
                embedding: embedding,
              });

            if (chunkError) {
              console.error(`Error inserting chunk ${chunkId}:`, chunkError);
            } else {
              totalChunks++;
            }
          } catch (embError) {
            console.error(`Error embedding chunk ${chunkId}:`, embError);
          }
        }

        filesProcessedThisBatch++;

        // Save checkpoint periodically
        if (filesProcessedThisBatch % 5 === 0) {
          await saveCheckpoint(supabase, connectionId, userId, {
            pageToken: nextPageToken || null,
            processedFiles: totalFiles,
            totalChunks,
          });
        }
      }

      if (nextPageToken) {
        pageToken = nextPageToken;
        // Save checkpoint before fetching next page
        await saveCheckpoint(supabase, connectionId, userId, {
          pageToken,
          processedFiles: totalFiles,
          totalChunks,
        });
      } else {
        hasMore = false;
      }
    }

    // Update sync status
    await supabase
      .from("gdrive_sync_status")
      .update({
        files_count: totalFiles,
        chunks_count: totalChunks,
        status: "indexed",
        synced_at: new Date().toISOString(),
        error: null,
      })
      .eq("connection_id", connectionId);

    // Clear checkpoint on success
    await clearCheckpoint(supabase, connectionId, userId);

    console.log(`Sync complete: ${totalFiles} files, ${totalChunks} chunks`);

    return new Response(
      JSON.stringify({
        ok: true,
        filesCount: totalFiles,
        chunksCount: totalChunks,
        hasMore: false,
        message: `Indexed ${totalFiles} files with ${totalChunks} chunks`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Sync error:", error);

    try {
      const body = await req.clone().json();
      if (body.connectionId) {
        const supabase = getServiceClient();
        const userId = await getUserIdOptional(req).catch(() => null);

        await supabase
          .from("gdrive_sync_status")
          .update({ status: "error", error: String(error) })
          .eq("connection_id", body.connectionId);

        // Save checkpoint with error for debugging
        await saveCheckpoint(supabase, body.connectionId, userId, {
          pageToken: null,
          processedFiles: 0,
          totalChunks: 0,
        }, "error", String(error));
      }
    } catch {}

    return new Response(
      JSON.stringify({ ok: false, error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
