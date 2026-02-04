-- Scalability Improvements Migration
-- Adds multi-tenant support, sources table, checkpointing, and updated RLS

-- ============================================
-- 1. CREATE SOURCES TABLE FOR MULTI-SOURCE SUPPORT
-- ============================================
CREATE TABLE IF NOT EXISTS public.sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  base_url TEXT NOT NULL,
  status TEXT DEFAULT 'not_indexed',
  docs_count INTEGER DEFAULT 0,
  user_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add trigger for updated_at
CREATE TRIGGER update_sources_updated_at
  BEFORE UPDATE ON public.sources
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- 2. ADD SOURCE_ID AND USER_ID TO DOCUMENTS
-- ============================================
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS source_id TEXT,
  ADD COLUMN IF NOT EXISTS user_id UUID;

-- Create index for source lookups
CREATE INDEX IF NOT EXISTS idx_documents_source_id ON public.documents(source_id);
CREATE INDEX IF NOT EXISTS idx_documents_user_id ON public.documents(user_id);

-- ============================================
-- 3. ADD USER_ID TO OTHER TABLES FOR MULTI-TENANT
-- ============================================
ALTER TABLE public.bundles
  ADD COLUMN IF NOT EXISTS user_id UUID;

ALTER TABLE public.feedback
  ADD COLUMN IF NOT EXISTS user_id UUID;

ALTER TABLE public.sync_status
  ADD COLUMN IF NOT EXISTS source_id TEXT,
  ADD COLUMN IF NOT EXISTS user_id UUID;

-- Remove the hardcoded UUID row approach - make source_id + user_id unique
ALTER TABLE public.sync_status
  DROP CONSTRAINT IF EXISTS sync_status_pkey CASCADE;

ALTER TABLE public.sync_status
  ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();

-- Add unique constraint for source_id + user_id combination
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sync_status_source_user_unique'
  ) THEN
    ALTER TABLE public.sync_status
      ADD CONSTRAINT sync_status_source_user_unique UNIQUE (source_id, user_id);
  END IF;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_bundles_user_id ON public.bundles(user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_user_id ON public.feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_sync_status_source_user ON public.sync_status(source_id, user_id);

-- ============================================
-- 4. ADD USER_ID TO GDRIVE TABLES
-- ============================================
ALTER TABLE public.gdrive_connections
  ADD COLUMN IF NOT EXISTS user_id UUID;

ALTER TABLE public.gdrive_files
  ADD COLUMN IF NOT EXISTS user_id UUID;

CREATE INDEX IF NOT EXISTS idx_gdrive_connections_user_id ON public.gdrive_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_gdrive_files_user_id ON public.gdrive_files(user_id);

-- ============================================
-- 5. CREATE SYNC_CHECKPOINTS TABLE FOR ERROR RECOVERY
-- ============================================
CREATE TABLE IF NOT EXISTS public.sync_checkpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id TEXT NOT NULL,
  user_id UUID,
  last_page INTEGER DEFAULT 0,
  last_item_id TEXT,
  processed_count INTEGER DEFAULT 0,
  total_count INTEGER,
  status TEXT DEFAULT 'in_progress',
  error TEXT,
  started_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(source_id, user_id)
);

-- Add trigger for updated_at
CREATE TRIGGER update_sync_checkpoints_updated_at
  BEFORE UPDATE ON public.sync_checkpoints
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- 6. CREATE QUERY EMBEDDING CACHE TABLE (OPTIONAL)
-- ============================================
CREATE TABLE IF NOT EXISTS public.query_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query_hash TEXT UNIQUE NOT NULL,
  query_text TEXT NOT NULL,
  embedding vector(384),
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '5 minutes')
);

-- Index for cache lookups
CREATE INDEX IF NOT EXISTS idx_query_cache_hash ON public.query_cache(query_hash);
CREATE INDEX IF NOT EXISTS idx_query_cache_expires ON public.query_cache(expires_at);

-- Function to clean expired cache entries
CREATE OR REPLACE FUNCTION public.clean_expired_query_cache()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM public.query_cache WHERE expires_at < now();
END;
$$;

-- ============================================
-- 7. UPDATE RLS POLICIES FOR MULTI-TENANT
-- ============================================

-- Enable RLS on new tables
ALTER TABLE public.sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_checkpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.query_cache ENABLE ROW LEVEL SECURITY;

-- Drop existing permissive policies
DROP POLICY IF EXISTS "Allow public read on documents" ON public.documents;
DROP POLICY IF EXISTS "Allow public read on document_chunks" ON public.document_chunks;
DROP POLICY IF EXISTS "Allow public read on bundles" ON public.bundles;
DROP POLICY IF EXISTS "Allow public read on bundle_documents" ON public.bundle_documents;
DROP POLICY IF EXISTS "Allow public read on feedback" ON public.feedback;
DROP POLICY IF EXISTS "Allow public read on sync_status" ON public.sync_status;
DROP POLICY IF EXISTS "Allow all access to gdrive_connections" ON public.gdrive_connections;
DROP POLICY IF EXISTS "Allow all access to gdrive_files" ON public.gdrive_files;
DROP POLICY IF EXISTS "Allow all access to gdrive_chunks" ON public.gdrive_chunks;
DROP POLICY IF EXISTS "Allow all access to gdrive_sync_status" ON public.gdrive_sync_status;

-- Create new RLS policies for tenant isolation
-- Documents: users can only see their own documents, or public ones (user_id is null)
CREATE POLICY "documents_select_policy" ON public.documents
  FOR SELECT USING (user_id IS NULL OR user_id = auth.uid());

CREATE POLICY "documents_insert_policy" ON public.documents
  FOR INSERT WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "documents_update_policy" ON public.documents
  FOR UPDATE USING (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "documents_delete_policy" ON public.documents
  FOR DELETE USING (user_id = auth.uid());

-- Document chunks follow parent document access
CREATE POLICY "document_chunks_select_policy" ON public.document_chunks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.id = document_chunks.document_id
      AND (d.user_id IS NULL OR d.user_id = auth.uid())
    )
  );

CREATE POLICY "document_chunks_insert_policy" ON public.document_chunks
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.id = document_chunks.document_id
      AND (d.user_id IS NULL OR d.user_id = auth.uid())
    )
  );

-- Bundles: user-specific
CREATE POLICY "bundles_select_policy" ON public.bundles
  FOR SELECT USING (user_id IS NULL OR user_id = auth.uid());

CREATE POLICY "bundles_insert_policy" ON public.bundles
  FOR INSERT WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "bundles_update_policy" ON public.bundles
  FOR UPDATE USING (user_id IS NULL OR user_id = auth.uid());

CREATE POLICY "bundles_delete_policy" ON public.bundles
  FOR DELETE USING (user_id = auth.uid() OR user_id IS NULL);

-- Bundle documents follow bundle access
CREATE POLICY "bundle_documents_select_policy" ON public.bundle_documents
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.bundles b
      WHERE b.id = bundle_documents.bundle_id
      AND (b.user_id IS NULL OR b.user_id = auth.uid())
    )
  );

CREATE POLICY "bundle_documents_all_policy" ON public.bundle_documents
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.bundles b
      WHERE b.id = bundle_documents.bundle_id
      AND (b.user_id IS NULL OR b.user_id = auth.uid())
    )
  );

-- Feedback: user-specific
CREATE POLICY "feedback_select_policy" ON public.feedback
  FOR SELECT USING (user_id IS NULL OR user_id = auth.uid());

CREATE POLICY "feedback_insert_policy" ON public.feedback
  FOR INSERT WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "feedback_update_policy" ON public.feedback
  FOR UPDATE USING (user_id IS NULL OR user_id = auth.uid());

-- Sync status: user-specific
CREATE POLICY "sync_status_select_policy" ON public.sync_status
  FOR SELECT USING (user_id IS NULL OR user_id = auth.uid());

CREATE POLICY "sync_status_all_policy" ON public.sync_status
  FOR ALL USING (user_id IS NULL OR user_id = auth.uid());

-- Sources: user-specific or public
CREATE POLICY "sources_select_policy" ON public.sources
  FOR SELECT USING (user_id IS NULL OR user_id = auth.uid());

CREATE POLICY "sources_insert_policy" ON public.sources
  FOR INSERT WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "sources_update_policy" ON public.sources
  FOR UPDATE USING (user_id IS NULL OR user_id = auth.uid());

-- Sync checkpoints: user-specific
CREATE POLICY "sync_checkpoints_all_policy" ON public.sync_checkpoints
  FOR ALL USING (user_id IS NULL OR user_id = auth.uid());

-- Query cache: public (shared across users for efficiency)
CREATE POLICY "query_cache_all_policy" ON public.query_cache
  FOR ALL USING (true);

-- GDrive connections: user-specific
CREATE POLICY "gdrive_connections_select_policy" ON public.gdrive_connections
  FOR SELECT USING (user_id IS NULL OR user_id = auth.uid());

CREATE POLICY "gdrive_connections_all_policy" ON public.gdrive_connections
  FOR ALL USING (user_id IS NULL OR user_id = auth.uid());

-- GDrive files: follow connection access
CREATE POLICY "gdrive_files_select_policy" ON public.gdrive_files
  FOR SELECT USING (
    user_id IS NULL OR user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.gdrive_connections gc
      WHERE gc.id = gdrive_files.connection_id
      AND (gc.user_id IS NULL OR gc.user_id = auth.uid())
    )
  );

CREATE POLICY "gdrive_files_all_policy" ON public.gdrive_files
  FOR ALL USING (
    user_id IS NULL OR user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.gdrive_connections gc
      WHERE gc.id = gdrive_files.connection_id
      AND (gc.user_id IS NULL OR gc.user_id = auth.uid())
    )
  );

-- GDrive chunks: follow file access
CREATE POLICY "gdrive_chunks_select_policy" ON public.gdrive_chunks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.gdrive_files gf
      WHERE gf.id = gdrive_chunks.file_id
      AND (gf.user_id IS NULL OR gf.user_id = auth.uid())
    )
  );

CREATE POLICY "gdrive_chunks_all_policy" ON public.gdrive_chunks
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.gdrive_files gf
      WHERE gf.id = gdrive_chunks.file_id
      AND (gf.user_id IS NULL OR gf.user_id = auth.uid())
    )
  );

-- GDrive sync status: follow connection access
CREATE POLICY "gdrive_sync_status_all_policy" ON public.gdrive_sync_status
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.gdrive_connections gc
      WHERE gc.id = gdrive_sync_status.connection_id
      AND (gc.user_id IS NULL OR gc.user_id = auth.uid())
    )
  );

-- ============================================
-- 8. SEED DEFAULT SOURCES
-- ============================================
INSERT INTO public.sources (source_id, name, base_url, status) VALUES
  ('techcrunch', 'TechCrunch', 'https://techcrunch.com', 'not_indexed'),
  ('mozilla', 'Mozilla Blog', 'https://blog.mozilla.org', 'not_indexed'),
  ('wpnews', 'WordPress.org News', 'https://wordpress.org/news', 'not_indexed'),
  ('smashing', 'Smashing Magazine', 'https://www.smashingmagazine.com', 'not_indexed'),
  ('nasa', 'NASA Blogs', 'https://blogs.nasa.gov', 'not_indexed')
ON CONFLICT (source_id) DO NOTHING;

-- ============================================
-- 9. UPDATE MATCH FUNCTIONS FOR OPTIONAL USER FILTERING
-- ============================================
CREATE OR REPLACE FUNCTION public.match_chunks(
  query_embedding vector(384),
  match_threshold FLOAT DEFAULT 0.2,
  match_count INT DEFAULT 20,
  filter_user_id UUID DEFAULT NULL,
  filter_source_id TEXT DEFAULT NULL
)
RETURNS TABLE (
  chunk_id TEXT,
  document_id UUID,
  doc_id TEXT,
  title TEXT,
  url TEXT,
  type TEXT,
  content TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    dc.chunk_id,
    dc.document_id,
    d.doc_id,
    d.title,
    d.url,
    d.type,
    dc.content,
    1 - (dc.embedding <=> query_embedding) AS similarity
  FROM public.document_chunks dc
  JOIN public.documents d ON dc.document_id = d.id
  WHERE dc.embedding IS NOT NULL
    AND 1 - (dc.embedding <=> query_embedding) > match_threshold
    AND (filter_user_id IS NULL OR d.user_id IS NULL OR d.user_id = filter_user_id)
    AND (filter_source_id IS NULL OR d.source_id = filter_source_id)
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Update gdrive match function similarly
CREATE OR REPLACE FUNCTION match_gdrive_chunks(
  query_embedding vector(384),
  match_threshold float DEFAULT 0.2,
  match_count int DEFAULT 20,
  filter_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
  chunk_id TEXT,
  content TEXT,
  file_id TEXT,
  file_name TEXT,
  mime_type TEXT,
  web_view_link TEXT,
  folder_path TEXT,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    gc.chunk_id,
    gc.content,
    gf.file_id,
    gf.name as file_name,
    gf.mime_type,
    gf.web_view_link,
    gf.folder_path,
    1 - (gc.embedding <=> query_embedding) as similarity
  FROM public.gdrive_chunks gc
  JOIN public.gdrive_files gf ON gc.file_id = gf.id
  WHERE 1 - (gc.embedding <=> query_embedding) > match_threshold
    AND (filter_user_id IS NULL OR gf.user_id IS NULL OR gf.user_id = filter_user_id)
  ORDER BY gc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
