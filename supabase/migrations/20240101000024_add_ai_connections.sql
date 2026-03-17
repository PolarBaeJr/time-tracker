CREATE TABLE IF NOT EXISTS public.ai_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  provider text NOT NULL CHECK (provider IN ('claude', 'openai', 'ollama')),
  api_key_encrypted text,
  model text,
  base_url text,
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, provider)
);

ALTER TABLE public.ai_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own AI connections" ON public.ai_connections FOR ALL USING (auth.uid() = user_id);

-- Add trigger for auto-updating updated_at
CREATE TRIGGER update_ai_connections_updated_at
  BEFORE UPDATE ON public.ai_connections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
