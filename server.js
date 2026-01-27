import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json({ limit: "12mb" }));
app.use(express.static("public"));

const PORT = Number(process.env.PORT || 8080);

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
const OLLAMA_EMBED_MODEL = process.env.OLLAMA_EMBED_MODEL || "nomic-embed-text";
const OLLAMA_CHAT_MODEL = process.env.OLLAMA_CHAT_MODEL || "llama3.1:8b";

const DEFAULT_SOURCES = [
  { sourceId: "techcrunch", name: "TechCrunch", baseUrl: "https://techcrunch.com" },
  { sourceId: "mozilla", name: "Mozilla Blog", baseUrl: "https://blog.mozilla.org" },
  { sourceId: "wpnews", name: "WordPress.org News", baseUrl: "https://wordpress.org/news" },
  { sourceId: "smashing", name: "Smashing Magazine", baseUrl: "https://www.smashingmagazine.com" },
  { sourceId: "nasa", name: "NASA Blogs", baseUrl: "https://blogs.nasa.gov" }
];

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

function chunkText(text, maxChars = 1200) {
  const t = String(text || "").replace(/\s+/g, " ").trim();
  if (!t) return [];
  const out = [];
  for (let i = 0; i < t.length; i += maxChars) out.push(t.slice(i, i + maxChars));
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

/*
In memory store for MVP
Replace later with Cassandra

sources: Map(sourceId -> meta)
docs: Map(sourceId -> Map(docId -> doc))
chunks: Map(sourceId -> Map(chunkId -> chunk))
vectors: Map(sourceId -> Map(chunkId -> embedding))
bundles: Map(bundleId -> { locked, docIds })
*/
const STORE = {
  sources: new Map(),
  docs: new Map(),
  chunks: new Map(),
  vectors: new Map(),
  bundles: new Map()
};

function ensureSourceMaps(sourceId) {
  if (!STORE.docs.has(sourceId)) STORE.docs.set(sourceId, new Map());
  if (!STORE.chunks.has(sourceId)) STORE.chunks.set(sourceId, new Map());
  if (!STORE.vectors.has(sourceId)) STORE.vectors.set(sourceId, new Map());
}

function registerDefaults() {
  for (const s of DEFAULT_SOURCES) {
    STORE.sources.set(s.sourceId, {
      ...s,
      status: "not_indexed",
      docs: 0,
      chunks: 0,
      lastSync: null,
      lastError: null
    });
    ensureSourceMaps(s.sourceId);
  }
}

registerDefaults();

async function indexSource(sourceId) {
  const src = STORE.sources.get(sourceId);
  if (!src) throw new Error("Unknown sourceId");

  src.status = "indexing";
  src.lastError = null;

  const api = wpApiBase(src.baseUrl);
  const posts = await fetchPagedJson(api, "/posts", 400);
  const pages = await fetchPagedJson(api, "/pages", 200);

  const docsMap = STORE.docs.get(sourceId);
  const chunksMap = STORE.chunks.get(sourceId);
  const vecMap = STORE.vectors.get(sourceId);

  docsMap.clear();
  chunksMap.clear();
  vecMap.clear();

  const all = [
    ...posts.map(p => ({ kind: "post", p })),
    ...pages.map(p => ({ kind: "page", p }))
  ];

  for (const { kind, p } of all) {
    const title = htmlToText(p?.title?.rendered || "Untitled");
    const link = String(p?.link || "").trim();
    const excerpt = htmlToText(p?.excerpt?.rendered || "");
    const body = htmlToText(p?.content?.rendered || "");
    const text = [title, excerpt, body].filter(Boolean).join("\n\n").trim();

    if (!link || !text) continue;

    const docId = `${sourceId}_${kind}_${p.id}`;
    docsMap.set(docId, {
      docId,
      sourceId,
      sourceName: src.name,
      type: kind,
      title,
      url: link,
      date: p.date || "",
      modified: p.modified || "",
      text
    });

    const chunks = chunkText(text, 1200);
    for (let i = 0; i < chunks.length; i += 1) {
      const chunkId = `${docId}::c${i + 1}`;
      const chunkVal = chunks[i];

      chunksMap.set(chunkId, {
        chunkId,
        docId,
        sourceId,
        type: kind,
        title,
        url: link,
        date: p.date || "",
        text: chunkVal
      });

      const v = await ollamaEmbed(`${title}\n\n${chunkVal}`);
      vecMap.set(chunkId, v);
    }
  }

  src.docs = docsMap.size;
  src.chunks = chunksMap.size;
  src.lastSync = nowIso();
  src.status = "indexed";

  return src;
}

function totals() {
  let totalDocs = 0;
  for (const s of STORE.sources.values()) totalDocs += Number(s.docs || 0);
  return { totalDocs };
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

app.get("/api/source/list", (req, res) => {
  res.json({ ok: true, sources: [...STORE.sources.values()], totals: totals() });
});

app.post("/api/source/sync", async (req, res) => {
  try {
    const sourceId = String(req.body.sourceId || "").trim();
    if (!sourceId) return res.status(400).json({ ok: false, error: "Missing sourceId" });
    const src = await indexSource(sourceId);
    res.json({ ok: true, source: src, totals: totals() });
  } catch (e) {
    const sourceId = String(req.body.sourceId || "").trim();
    const src = STORE.sources.get(sourceId);
    if (src) {
      src.status = "error";
      src.lastError = String(e.message || e);
    }
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

app.post("/api/search", async (req, res) => {
  try {
    const query = String(req.body.query || "").trim();
    const sourceIds = Array.isArray(req.body.sourceIds) ? req.body.sourceIds : [];
    const topK = Math.min(Math.max(Number(req.body.topK || 8), 1), 12);

    if (!query) return res.json({ ok: true, results: [], reason: "empty_query" });

    const active = sourceIds.length ? sourceIds : [...STORE.sources.keys()];
    const qVec = await ollamaEmbed(query);

    const candidates = [];

    for (const sid of active) {
      const src = STORE.sources.get(sid);
      if (!src || src.status !== "indexed") continue;

      const vecMap = STORE.vectors.get(sid);
      const chMap = STORE.chunks.get(sid);

      for (const [chunkId, vec] of vecMap.entries()) {
        const score = cosine(qVec, vec);
        if (score <= 0) continue;

        const ch = chMap.get(chunkId);
        if (!ch) continue;

        candidates.push({
          docId: ch.docId,
          sourceId: sid,
          sourceName: src.name,
          type: ch.type,
          title: ch.title,
          url: ch.url,
          snippet: ch.text.slice(0, 260),
          score
        });
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

app.post("/api/bundle/create", (req, res) => {
  const bundleId = `b_${Date.now()}`;
  STORE.bundles.set(bundleId, { bundleId, locked: false, docIds: [] });
  res.json({ ok: true, bundleId });
});

app.post("/api/bundle/add", (req, res) => {
  const bundleId = String(req.body.bundleId || "");
  const docId = String(req.body.docId || "");
  if (!bundleId || !docId) return res.status(400).json({ ok: false });

  const b = STORE.bundles.get(bundleId);
  if (!b) return res.status(404).json({ ok: false });
  if (b.locked) return res.status(400).json({ ok: false, reason: "locked" });

  if (!b.docIds.includes(docId)) b.docIds.push(docId);
  res.json({ ok: true, docIds: b.docIds, locked: b.locked });
});

app.post("/api/bundle/remove", (req, res) => {
  const bundleId = String(req.body.bundleId || "");
  const docId = String(req.body.docId || "");
  if (!bundleId || !docId) return res.status(400).json({ ok: false });

  const b = STORE.bundles.get(bundleId);
  if (!b) return res.status(404).json({ ok: false });
  if (b.locked) return res.status(400).json({ ok: false, reason: "locked" });

  b.docIds = b.docIds.filter(id => id !== docId);
  res.json({ ok: true, docIds: b.docIds, locked: b.locked });
});

app.post("/api/bundle/lock", (req, res) => {
  const bundleId = String(req.body.bundleId || "");
  const b = STORE.bundles.get(bundleId);
  if (!b) return res.status(404).json({ ok: false });
  b.locked = true;
  res.json({ ok: true, locked: true });
});

app.post("/api/bundle/clear", (req, res) => {
  const bundleId = String(req.body.bundleId || "");
  const b = STORE.bundles.get(bundleId);
  if (!b) return res.status(404).json({ ok: false });
  b.docIds = [];
  b.locked = false;
  res.json({ ok: true, docIds: [], locked: false });
});

app.post("/api/ask", async (req, res) => {
  try {
    const bundleId = String(req.body.bundleId || "");
    const question = String(req.body.question || "").trim();

    if (!bundleId || !question) return res.status(400).json({ ok: false });

    const b = STORE.bundles.get(bundleId);
    if (!b) return res.status(404).json({ ok: false });
    if (!b.locked) return res.status(400).json({ ok: false, reason: "bundle_not_locked" });
    if (!b.docIds.length) return res.json({ ok: true, answer: "Not found in selected sources", citations: [] });

    const qVec = await ollamaEmbed(question);

    const citePool = [];
    for (const docId of b.docIds) {
      const sourceId = String(docId).split("_")[0];
      const chMap = STORE.chunks.get(sourceId);
      const vMap = STORE.vectors.get(sourceId);
      if (!chMap || !vMap) continue;

      for (const [chunkId, vec] of vMap.entries()) {
        const ch = chMap.get(chunkId);
        if (!ch || ch.docId !== docId) continue;
        citePool.push({ chunkId, ch, score: cosine(qVec, vec) });
      }
    }

    citePool.sort((a, b2) => b2.score - a.score);
    const top = citePool.slice(0, 8);

    if (!top.length || top[0].score < 0.22) {
      return res.json({ ok: true, answer: "Not found in selected sources", citations: [] });
    }

    const citations = top.map((t, i) => ({
      id: `C${i + 1}`,
      url: t.ch.url,
      title: t.ch.title,
      excerpt: t.ch.text.slice(0, 900)
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
