-- Create table for Google Drive connections/tokens
CREATE TABLE public.gdrive_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for indexed Google Drive files
CREATE TABLE public.gdrive_files (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  connection_id UUID REFERENCES public.gdrive_connections(id) ON DELETE CASCADE,
  file_id TEXT NOT NULL,
  name TEXT NOT NULL,
  mime_type TEXT,
  web_view_link TEXT,
  folder_path TEXT,
  full_text TEXT,
  modified_time TIMESTAMP WITH TIME ZONE,
  indexed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(connection_id, file_id)
);

-- Create table for Google Drive file chunks with embeddings
CREATE TABLE public.gdrive_chunks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  file_id UUID REFERENCES public.gdrive_files(id) ON DELETE CASCADE,
  chunk_id TEXT NOT NULL UNIQUE,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  embedding vector(384),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for vector similarity search
CREATE INDEX gdrive_chunks_embedding_idx ON public.gdrive_chunks 
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Create sync status table for Google Drive
CREATE TABLE public.gdrive_sync_status (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  connection_id UUID REFERENCES public.gdrive_connections(id) ON DELETE CASCADE,
  files_count INTEGER DEFAULT 0,
  chunks_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'idle',
  synced_at TIMESTAMP WITH TIME ZONE,
  error TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(connection_id)
);

-- Create function for matching Google Drive chunks (similar to existing match_chunks)
CREATE OR REPLACE FUNCTION match_gdrive_chunks(
  query_embedding vector(384),
  match_threshold float DEFAULT 0.2,
  match_count int DEFAULT 20
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
  ORDER BY gc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Enable RLS on all tables
ALTER TABLE public.gdrive_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gdrive_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gdrive_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gdrive_sync_status ENABLE ROW LEVEL SECURITY;

-- For now, allow all operations (no auth required for this demo app)
CREATE POLICY "Allow all access to gdrive_connections" ON public.gdrive_connections FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to gdrive_files" ON public.gdrive_files FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to gdrive_chunks" ON public.gdrive_chunks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to gdrive_sync_status" ON public.gdrive_sync_status FOR ALL USING (true) WITH CHECK (true);

-- Create updated_at trigger function if not exists
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updated_at
CREATE TRIGGER update_gdrive_connections_updated_at
  BEFORE UPDATE ON public.gdrive_connections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_gdrive_files_updated_at
  BEFORE UPDATE ON public.gdrive_files
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();