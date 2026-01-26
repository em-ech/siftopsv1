-- Drop the existing embedding column and recreate with correct dimensions
ALTER TABLE public.document_chunks DROP COLUMN IF EXISTS embedding;
ALTER TABLE public.document_chunks ADD COLUMN embedding vector(384);

-- Drop and recreate the index
DROP INDEX IF EXISTS idx_document_chunks_embedding;
CREATE INDEX idx_document_chunks_embedding ON public.document_chunks 
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Update the match_chunks function to use 384 dimensions
DROP FUNCTION IF EXISTS public.match_chunks;
CREATE OR REPLACE FUNCTION public.match_chunks(
  query_embedding vector(384),
  match_threshold FLOAT DEFAULT 0.2,
  match_count INT DEFAULT 20
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
    (1 - (dc.embedding <=> query_embedding))::FLOAT AS similarity
  FROM public.document_chunks dc
  JOIN public.documents d ON dc.document_id = d.id
  WHERE dc.embedding IS NOT NULL
    AND 1 - (dc.embedding <=> query_embedding) > match_threshold
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;