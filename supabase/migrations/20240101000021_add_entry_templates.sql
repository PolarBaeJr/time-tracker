CREATE TABLE IF NOT EXISTS public.entry_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  notes text DEFAULT '',
  duration_seconds integer NOT NULL DEFAULT 0,
  is_billable boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.entry_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own entry templates" ON public.entry_templates FOR ALL USING (auth.uid() = user_id);
