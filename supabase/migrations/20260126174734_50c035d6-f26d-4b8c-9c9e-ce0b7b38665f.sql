-- Add INSERT/UPDATE/DELETE policies for service role operations (edge functions)
CREATE POLICY "Allow service role insert on documents" ON public.documents 
FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow service role update on documents" ON public.documents 
FOR UPDATE USING (true);

CREATE POLICY "Allow service role delete on documents" ON public.documents 
FOR DELETE USING (true);

CREATE POLICY "Allow service role insert on document_chunks" ON public.document_chunks 
FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow service role update on document_chunks" ON public.document_chunks 
FOR UPDATE USING (true);

CREATE POLICY "Allow service role delete on document_chunks" ON public.document_chunks 
FOR DELETE USING (true);

CREATE POLICY "Allow public insert on bundles" ON public.bundles 
FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update on bundles" ON public.bundles 
FOR UPDATE USING (true);

CREATE POLICY "Allow public delete on bundles" ON public.bundles 
FOR DELETE USING (true);

CREATE POLICY "Allow public insert on bundle_documents" ON public.bundle_documents 
FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public delete on bundle_documents" ON public.bundle_documents 
FOR DELETE USING (true);

CREATE POLICY "Allow public insert on feedback" ON public.feedback 
FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update on feedback" ON public.feedback 
FOR UPDATE USING (true);

CREATE POLICY "Allow service role update on sync_status" ON public.sync_status 
FOR UPDATE USING (true);