-- Update the match_chunks function to properly cast vectors
DROP FUNCTION IF EXISTS public.match_chunks;
CREATE OR REPLACE FUNCTION public.match_chunks(
  query_embedding TEXT,
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
SET search_path = public, extensions
AS $$
DECLARE
  query_vec extensions.vector(384);
BEGIN
  -- Parse the JSON array into a vector
  query_vec := query_embedding::extensions.vector(384);
  
  RETURN QUERY
  SELECT 
    dc.chunk_id,
    dc.document_id,
    d.doc_id,
    d.title,
    d.url,
    d.type,
    dc.content,
    (1 - (dc.embedding <=> query_vec))::FLOAT AS similarity
  FROM public.document_chunks dc
  JOIN public.documents d ON dc.document_id = d.id
  WHERE dc.embedding IS NOT NULL
    AND 1 - (dc.embedding <=> query_vec) > match_threshold
  ORDER BY dc.embedding <=> query_vec
  LIMIT match_count;
END;
$$;