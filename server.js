import express from "express";
import cors from "cors";
import { createClient } from "@supabase/supabase-js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "12mb" }));
app.use(express.static("public"));

const PORT = Number(process.env.PORT || 8080);

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
const OLLAMA_EMBED_MODEL = process.env.OLLAMA_EMBED_MODEL || "nomic-embed-text";
const OLLAMA_CHAT_MODEL = process.env.OLLAMA_CHAT_MODEL || "llama3.1:8b";

// Supabase client (singleton pattern for connection reuse)
let _supabase = null;
function getSupabase() {
  if (!_supabase) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
    if (url && key) {
      _supabase = createClient(url, key);
    }
  }
  return _supabase;
}

// Default sources (for seeding)
const DEFAULT_SOURCES = [
  { sourceId: "techcrunch", name: "TechCrunch", baseUrl: "https://techcrunch.com" },
  { sourceId: "mozilla", name: "Mozilla Blog", baseUrl: "https://blog.mozilla.org" },
  { sourceId: "wpnews", name: "WordPress.org News", baseUrl: "https://wordpress.org/news" },
  { sourceId: "smashing", name: "Smashing Magazine", baseUrl: "https://www.smashingmagazine.com" },
  { sourceId: "nasa", name: "NASA Blogs", baseUrl: "https://blogs.nasa.gov" }
];

// Chunking configuration (matches edge functions)
const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 150;

function wpApiBase(baseUrl) {
  return `${String(baseUrl || "").replace(/\/$/, "")}/wp-json/wp/v2`;
}

function nowIso() {
  return new Date().toISOString();
}

function htmlToText(html) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function chunkText(text, maxChars = CHUNK_SIZE, overlap = CHUNK_OVERLAP) {
  const t = String(text || "").replace(/\s+/g, " ").trim();
  if (!t) return [];
  if (t.length <= maxChars) return [t];

  const out = [];
  let start = 0;

  while (start < t.length) {
    let end = Math.min(start + maxChars, t.length);
    const chunk = t.slice(start, end).trim();
    if (chunk) out.push(chunk);
    if (end >= t.length) break;
    start = end - overlap;
    if (start <= 0 && out.length > 0) start = end;
  }

  return out;
}

function cosine(a, b) {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i += 1) {
    const x = a[i];
    const y = b[i];
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  if (!denom) return 0;
  return dot / denom;
}

async function ollamaEmbed(text) {
  const r = await fetch(`${OLLAMA_BASE_URL}/api/embeddings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: OLLAMA_EMBED_MODEL, prompt: text })
  });
  if (!r.ok) throw new Error("Ollama embeddings failed");
  const out = await r.json();
  if (!out.embedding) throw new Error("Ollama missing embedding");
  return out.embedding;
}

async function ollamaGenerate(system, userPrompt) {
  const prompt = system
    ? `System\n${system}\n\nUser\n${userPrompt}`
    : userPrompt;

  const r = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: OLLAMA_CHAT_MODEL,
      prompt,
      stream: false
    })
  });
  if (!r.ok) throw new Error("Ollama generate failed");
  const out = await r.json();
  return String(out.response || "").trim();
}

async function fetchPagedJson(apiBase, endpoint, maxItems) {
  const perPage = 50;
  let page = 1;
  const all = [];

  while (all.length < maxItems) {
    const url = `${apiBase}${endpoint}?per_page=${perPage}&page=${page}`;
    const r = await fetch(url);
    if (!r.ok) break;

    const items = await r.json();
    if (!Array.isArray(items) || items.length === 0) break;

    all.push(...items);

    const totalPagesHeader = r.headers.get("x-wp-totalpages");
    const totalPages = totalPagesHeader ? Number(totalPagesHeader) : null;
    if (totalPages && page >= totalPages) break;

    page += 1;
  }

  return all.slice(0, maxItems);
}

// Helper to get sources from Supabase or fallback to defaults
async function getSources() {
  const supabase = getSupabase();
  if (supabase) {
    const { data } = await supabase.from("sources").select("*");
    if (data && data.length > 0) {
      return data.map(s => ({
        sourceId: s.source_id,
        name: s.name,
        baseUrl: s.base_url,
        status: s.status || "not_indexed",
        docs: s.docs_count || 0,
        chunks: 0,
        lastSync: null,
        lastError: null
      }));
    }
  }
  return DEFAULT_SOURCES.map(s => ({
    ...s,
    status: "not_indexed",
    docs: 0,
    chunks: 0,
    lastSync: null,
    lastError: null
  }));
}

// Helper to get totals from Supabase
async function getTotals() {
  const supabase = getSupabase();
  if (supabase) {
    const { count: docsCount } = await supabase
      .from("documents")
      .select("*", { count: "exact", head: true });
    return { totalDocs: docsCount || 0 };
  }
  return { totalDocs: 0 };
}

// Index a source - stores in Supabase if available
async function indexSource(sourceId) {
  const sources = await getSources();
  const src = sources.find(s => s.sourceId === sourceId);
  if (!src) throw new Error("Unknown sourceId");

  const supabase = getSupabase();

  // Update status to indexing
  if (supabase) {
    await supabase.from("sources").upsert({
      source_id: sourceId,
      name: src.name,
      base_url: src.baseUrl,
      status: "indexing"
    }, { onConflict: "source_id" });
  }

  const api = wpApiBase(src.baseUrl);
  const posts = await fetchPagedJson(api, "/posts", 200);
  const pages = await fetchPagedJson(api, "/pages", 50);

  const all = [
    ...posts.map(p => ({ kind: "post", p })),
    ...pages.map(p => ({ kind: "page", p }))
  ];

  let docsInserted = 0;
  let chunksCreated = 0;

  for (const { kind, p } of all) {
    const title = htmlToText(p?.title?.rendered || "Untitled");
    const link = String(p?.link || "").trim();
    const excerpt = htmlToText(p?.excerpt?.rendered || "");
    const body = htmlToText(p?.content?.rendered || "");
    const text = [title, excerpt, body].filter(Boolean).join("\n\n").trim();

    if (!link || !text) continue;

    const docId = `${sourceId}_${kind}_${p.id}`;

    if (supabase) {
      // Check if exists
      const { data: existing } = await supabase
        .from("documents")
        .select("id")
        .eq("doc_id", docId)
        .single();

      let documentId;
      if (existing) {
        documentId = existing.id;
      } else {
        const { data: newDoc, error: docError } = await supabase
          .from("documents")
          .insert({
            doc_id: docId,
            source_id: sourceId,
            type: kind,
            title: title.slice(0, 500),
            url: link,
            full_text: text.slice(0, 10000),
            published_at: p.date || null
          })
          .select("id")
          .single();

        if (docError) {
          console.error(`Error inserting doc ${docId}:`, docError.message);
          continue;
        }
        documentId = newDoc.id;
        docsInserted++;
      }

      // Check if chunks exist
      const { data: existingChunks } = await supabase
        .from("document_chunks")
        .select("id")
        .eq("document_id", documentId)
        .limit(1);

      if (existingChunks && existingChunks.length > 0) {
        continue;
      }

      // Create chunks with embeddings
      const chunks = chunkText(text, CHUNK_SIZE, CHUNK_OVERLAP);
      for (let i = 0; i < chunks.length; i++) {
        const chunkId = `${docId}::c${i + 1}`;
        const chunkVal = chunks[i];

        try {
          const v = await ollamaEmbed(`${title}\n\n${chunkVal}`);
          const embeddingStr = `[${v.join(",")}]`;

          const { error: chunkError } = await supabase
            .from("document_chunks")
            .insert({
              chunk_id: chunkId,
              document_id: documentId,
              chunk_index: i,
              content: chunkVal,
              embedding: embeddingStr
            });

          if (!chunkError) chunksCreated++;
        } catch (e) {
          console.error(`Embedding error for ${chunkId}:`, e.message);
        }
      }
    }
  }

  // Update source status
  if (supabase) {
    const { count: totalDocs } = await supabase
      .from("documents")
      .select("*", { count: "exact", head: true })
      .eq("source_id", sourceId);

    await supabase.from("sources").upsert({
      source_id: sourceId,
      name: src.name,
      base_url: src.baseUrl,
      status: "indexed",
      docs_count: totalDocs || 0
    }, { onConflict: "source_id" });
  }

  return {
    sourceId,
    name: src.name,
    status: "indexed",
    docs: docsInserted,
    chunks: chunksCreated,
    lastSync: nowIso()
  };
}

function bestDocsFromCandidates(candidates, limit) {
  const best = new Map();
  for (const c of candidates) {
    const key = `${c.sourceId}::${c.docId}`;
    const cur = best.get(key);
    if (!cur || c.score > cur.score) best.set(key, c);
  }
  return [...best.values()].sort((a, b) => b.score - a.score).slice(0, limit);
}

// API Routes

app.get("/api/source/list", async (req, res) => {
  try {
    const sources = await getSources();
    const totals = await getTotals();
    res.json({ ok: true, sources, totals });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

app.post("/api/source/sync", async (req, res) => {
  try {
    const sourceId = String(req.body.sourceId || "").trim();
    if (!sourceId) return res.status(400).json({ ok: false, error: "Missing sourceId" });
    const src = await indexSource(sourceId);
    const totals = await getTotals();
    res.json({ ok: true, source: src, totals });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

app.post("/api/search", async (req, res) => {
  try {
    const query = String(req.body.query || "").trim();
    const sourceIds = Array.isArray(req.body.sourceIds) ? req.body.sourceIds : [];
    const topK = Math.min(Math.max(Number(req.body.topK || 8), 1), 12);

    if (!query) return res.json({ ok: true, results: [], reason: "empty_query" });

    const supabase = getSupabase();
    const qVec = await ollamaEmbed(query);
    const candidates = [];

    if (supabase) {
      // Use Supabase RPC for vector search
      const embeddingStr = `[${qVec.join(",")}]`;
      const { data: matches, error } = await supabase.rpc("match_chunks", {
        query_embedding: embeddingStr,
        match_threshold: 0.2,
        match_count: 50
      });

      if (error) {
        console.error("Match error:", error);
      } else if (matches) {
        for (const m of matches) {
          // Filter by source if specified
          if (sourceIds.length > 0) {
            const docSourceId = m.doc_id?.split("_")[0];
            if (!sourceIds.includes(docSourceId)) continue;
          }

          candidates.push({
            docId: m.doc_id,
            sourceId: m.doc_id?.split("_")[0] || "unknown",
            sourceName: m.doc_id?.split("_")[0] || "Unknown",
            type: m.type,
            title: m.title,
            url: m.url,
            snippet: m.content?.slice(0, 260) || "",
            score: m.similarity
          });
        }
      }
    }

    candidates.sort((a, b) => b.score - a.score);
    const results = bestDocsFromCandidates(candidates.slice(0, 160), topK);

    if (!results.length || results[0].score < 0.22) {
      return res.json({ ok: true, results: [], reason: "low_confidence" });
    }

    res.json({ ok: true, results, reason: "" });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

// Bundle management with Supabase
app.post("/api/bundle/create", async (req, res) => {
  const bundleId = `b_${Date.now()}`;
  const supabase = getSupabase();

  if (supabase) {
    const { error } = await supabase.from("bundles").insert({
      bundle_id: bundleId,
      locked: false
    });
    if (error) {
      return res.status(500).json({ ok: false, error: error.message });
    }
  }

  res.json({ ok: true, bundleId });
});

app.post("/api/bundle/add", async (req, res) => {
  const bundleId = String(req.body.bundleId || "");
  const docId = String(req.body.docId || "");
  if (!bundleId || !docId) return res.status(400).json({ ok: false });

  const supabase = getSupabase();
  if (!supabase) return res.status(500).json({ ok: false, error: "Database not configured" });

  const { data: bundle } = await supabase
    .from("bundles")
    .select("*")
    .eq("bundle_id", bundleId)
    .single();

  if (!bundle) return res.status(404).json({ ok: false });
  if (bundle.locked) return res.status(400).json({ ok: false, reason: "locked" });

  const { data: doc } = await supabase
    .from("documents")
    .select("id")
    .eq("doc_id", docId)
    .single();

  if (!doc) return res.status(404).json({ ok: false, error: "Document not found" });

  await supabase.from("bundle_documents").upsert({
    bundle_id: bundle.id,
    document_id: doc.id
  }, { onConflict: "bundle_id,document_id" });

  const { data: bundleDocs } = await supabase
    .from("bundle_documents")
    .select("document_id, documents(doc_id)")
    .eq("bundle_id", bundle.id);

  const docIds = bundleDocs?.map(bd => bd.documents?.doc_id).filter(Boolean) || [];

  res.json({ ok: true, docIds, locked: bundle.locked });
});

app.post("/api/bundle/remove", async (req, res) => {
  const bundleId = String(req.body.bundleId || "");
  const docId = String(req.body.docId || "");
  if (!bundleId || !docId) return res.status(400).json({ ok: false });

  const supabase = getSupabase();
  if (!supabase) return res.status(500).json({ ok: false, error: "Database not configured" });

  const { data: bundle } = await supabase
    .from("bundles")
    .select("*")
    .eq("bundle_id", bundleId)
    .single();

  if (!bundle) return res.status(404).json({ ok: false });
  if (bundle.locked) return res.status(400).json({ ok: false, reason: "locked" });

  const { data: doc } = await supabase
    .from("documents")
    .select("id")
    .eq("doc_id", docId)
    .single();

  if (doc) {
    await supabase
      .from("bundle_documents")
      .delete()
      .eq("bundle_id", bundle.id)
      .eq("document_id", doc.id);
  }

  const { data: bundleDocs } = await supabase
    .from("bundle_documents")
    .select("document_id, documents(doc_id)")
    .eq("bundle_id", bundle.id);

  const docIds = bundleDocs?.map(bd => bd.documents?.doc_id).filter(Boolean) || [];

  res.json({ ok: true, docIds, locked: bundle.locked });
});

app.post("/api/bundle/lock", async (req, res) => {
  const bundleId = String(req.body.bundleId || "");
  const supabase = getSupabase();

  if (!supabase) return res.status(500).json({ ok: false, error: "Database not configured" });

  const { error } = await supabase
    .from("bundles")
    .update({ locked: true })
    .eq("bundle_id", bundleId);

  if (error) return res.status(500).json({ ok: false, error: error.message });

  res.json({ ok: true, locked: true });
});

app.post("/api/bundle/clear", async (req, res) => {
  const bundleId = String(req.body.bundleId || "");
  const supabase = getSupabase();

  if (!supabase) return res.status(500).json({ ok: false, error: "Database not configured" });

  const { data: bundle } = await supabase
    .from("bundles")
    .select("id")
    .eq("bundle_id", bundleId)
    .single();

  if (bundle) {
    await supabase.from("bundle_documents").delete().eq("bundle_id", bundle.id);
    await supabase.from("bundles").update({ locked: false }).eq("id", bundle.id);
  }

  res.json({ ok: true, docIds: [], locked: false });
});

app.post("/api/ask", async (req, res) => {
  try {
    const bundleId = String(req.body.bundleId || "");
    const question = String(req.body.question || "").trim();

    if (!bundleId || !question) return res.status(400).json({ ok: false });

    const supabase = getSupabase();
    if (!supabase) return res.status(500).json({ ok: false, error: "Database not configured" });

    const { data: bundle } = await supabase
      .from("bundles")
      .select("*")
      .eq("bundle_id", bundleId)
      .single();

    if (!bundle) return res.status(404).json({ ok: false });
    if (!bundle.locked) return res.status(400).json({ ok: false, reason: "bundle_not_locked" });

    // Get bundle documents
    const { data: bundleDocs } = await supabase
      .from("bundle_documents")
      .select("document_id")
      .eq("bundle_id", bundle.id);

    if (!bundleDocs || !bundleDocs.length) {
      return res.json({ ok: true, answer: "Not found in selected sources", citations: [] });
    }

    const docIds = bundleDocs.map(bd => bd.document_id);

    // Get documents
    const { data: docs } = await supabase
      .from("documents")
      .select("*")
      .in("id", docIds);

    // Get chunks
    const { data: chunks } = await supabase
      .from("document_chunks")
      .select("*")
      .in("document_id", docIds)
      .limit(50);

    if (!docs?.length || !chunks?.length) {
      return res.json({ ok: true, answer: "Not found in selected sources", citations: [] });
    }

    // Embed question and find relevant chunks
    const qVec = await ollamaEmbed(question);

    const citePool = [];
    for (const chunk of chunks) {
      // Parse embedding from string if needed
      let chunkVec = chunk.embedding;
      if (typeof chunkVec === "string") {
        try {
          chunkVec = JSON.parse(chunkVec);
        } catch {
          continue;
        }
      }
      if (!Array.isArray(chunkVec)) continue;

      const doc = docs.find(d => d.id === chunk.document_id);
      if (!doc) continue;

      const score = cosine(qVec, chunkVec);
      citePool.push({
        chunk,
        doc,
        score
      });
    }

    citePool.sort((a, b) => b.score - a.score);
    const top = citePool.slice(0, 8);

    if (!top.length || top[0].score < 0.22) {
      return res.json({ ok: true, answer: "Not found in selected sources", citations: [] });
    }

    const citations = top.map((t, i) => ({
      id: `C${i + 1}`,
      url: t.doc.url,
      title: t.doc.title,
      excerpt: t.chunk.content?.slice(0, 900) || ""
    }));

    const system =
      "You must use only the Evidence. If Evidence does not support the answer, respond exactly: Not found in selected sources. " +
      "Cite sources using brackets like [C1]. Keep the answer short.";

    const evidence = citations
      .map(c => `${c.id}\n${c.url}\n${c.excerpt}`)
      .join("\n\n");

    const userPrompt = `Question\n${question}\n\nEvidence\n${evidence}`;
    const answer = await ollamaGenerate(system, userPrompt);

    res.json({ ok: true, answer, citations });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

app.listen(PORT, () => console.log(`SiftOps running on ${PORT}`));
