-- Entry attachments table
CREATE TABLE IF NOT EXISTS public.entry_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  time_entry_id uuid NOT NULL REFERENCES public.time_entries(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_size bigint NOT NULL,
  content_type text NOT NULL,
  storage_path text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.entry_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own entry attachments" ON public.entry_attachments FOR ALL USING (auth.uid() = user_id);

-- Storage bucket for attachments
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('entry-attachments', 'entry-attachments', false, 10485760, ARRAY['image/jpeg','image/png','image/gif','image/webp','application/pdf'])
ON CONFLICT (id) DO NOTHING;

-- Storage RLS policies
CREATE POLICY "Users can upload own attachments" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'entry-attachments' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users can view own attachments" ON storage.objects FOR SELECT USING (bucket_id = 'entry-attachments' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users can delete own attachments" ON storage.objects FOR DELETE USING (bucket_id = 'entry-attachments' AND (storage.foldername(name))[1] = auth.uid()::text);
