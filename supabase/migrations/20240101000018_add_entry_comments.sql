-- Entry comments table for adding notes/timeline to time entries
CREATE TABLE entry_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  time_entry_id uuid NOT NULL REFERENCES time_entries(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE entry_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own entry comments" ON entry_comments FOR ALL
  USING (auth.uid() = user_id);
