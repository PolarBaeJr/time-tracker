-- Tags table for labeling time entries
CREATE TABLE tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#6366f1',
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, name)
);

-- Junction table for many-to-many relationship between time entries and tags
CREATE TABLE time_entry_tags (
  time_entry_id uuid NOT NULL REFERENCES time_entries(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (time_entry_id, tag_id)
);

ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_entry_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own tags" ON tags FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own entry tags" ON time_entry_tags FOR ALL
  USING (EXISTS (SELECT 1 FROM time_entries WHERE id = time_entry_id AND user_id = auth.uid()));
