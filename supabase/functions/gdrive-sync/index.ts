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

async function getEmbedding(text: string): Promise<string> {
  const embedding = await embeddingModel.run(text.slice(0, 1500), {
    mean_pool: true,
    normalize: true,
  });
  const arr = Array.from(embedding as Float32Array);
  return `[${arr.join(',')}]`;
}

function chunkText(text: string, maxChars: number = 800, overlap: number = 100): string[] {
  const t = String(text || "").replace(/\s+/g, " ").trim();
  if (!t) return [];
  const out: string[] = [];
  let start = 0;
  while (start < t.length) {
    const end = Math.min(start + maxChars, t.length);
    out.push(t.slice(start, end));
    start = end - overlap;
    if (start >= t.length - overlap) break;
  }
  return out;
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
async function fetchDriveFiles(accessToken: string, folderId?: string): Promise<any[]> {
  const files: any[] = [];
  let pageToken: string | null = null;

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

  do {
    const url = new URL("https://www.googleapis.com/drive/v3/files");
    url.searchParams.set("q", query);
    url.searchParams.set("fields", "nextPageToken,files(id,name,mimeType,webViewLink,modifiedTime,parents)");
    url.searchParams.set("pageSize", "100");
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
    files.push(...(data.files || []));
    pageToken = data.nextPageToken || null;

    // Limit to 50 files per sync to avoid timeouts
    if (files.length >= 50) break;
  } while (pageToken);

  return files;
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
  // For PDFs and other binary formats, we'd need additional processing
  // For now, we'll only fully support Google Docs and plain text
  
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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { connectionId, folderId } = await req.json();
    
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

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

    // Update sync status to indexing
    await supabase
      .from("gdrive_sync_status")
      .update({ status: "indexing", error: null })
      .eq("connection_id", connectionId);

    console.log("Fetching files from Google Drive...");
    const driveFiles = await fetchDriveFiles(accessToken, folderId);
    console.log(`Found ${driveFiles.length} files`);

    // Clear existing files for this connection
    await supabase
      .from("gdrive_files")
      .delete()
      .eq("connection_id", connectionId);

    let totalFiles = 0;
    let totalChunks = 0;

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
          full_text: content.slice(0, 50000), // Limit stored text
          modified_time: file.modifiedTime,
          indexed_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (fileError) {
        console.error(`Error inserting file ${file.name}:`, fileError);
        continue;
      }

      totalFiles++;

      // Chunk and embed content
      const chunks = chunkText(content, 800, 100);
      
      for (let i = 0; i < Math.min(chunks.length, 10); i++) { // Limit chunks per file
        const chunkId = `${file.id}::c${i + 1}`;
        const chunkContent = chunks[i];

        try {
          console.log(`Embedding chunk ${i + 1}/${chunks.length} for ${file.name}`);
          const embedding = await getEmbedding(`${file.name}\n\n${chunkContent}`);

          const { error: chunkError } = await supabase
            .from("gdrive_chunks")
            .insert({
              file_id: fileRecord.id,
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

    console.log(`Sync complete: ${totalFiles} files, ${totalChunks} chunks`);

    return new Response(
      JSON.stringify({
        ok: true,
        filesCount: totalFiles,
        chunksCount: totalChunks,
        hasMore: driveFiles.length >= 50,
        message: `Indexed ${totalFiles} files with ${totalChunks} chunks`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Sync error:", error);

    try {
      const body = await req.clone().json();
      if (body.connectionId) {
        const supabase = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );
        await supabase
          .from("gdrive_sync_status")
          .update({ status: "error", error: String(error) })
          .eq("connection_id", body.connectionId);
      }
    } catch {}

    return new Response(
      JSON.stringify({ ok: false, error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
