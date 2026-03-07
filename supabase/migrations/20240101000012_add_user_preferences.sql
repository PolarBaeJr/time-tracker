ALTER TABLE public.users ADD COLUMN IF NOT EXISTS preferences jsonb NOT NULL DEFAULT '{}';
COMMENT ON COLUMN public.users.preferences IS 'User preferences JSONB: pomodoro settings, goal defaults, custom presets';
