-- Migration: Add Calendar Connections and Calendar Events tables
-- Supports Google Calendar and Outlook Calendar OAuth integrations

-- =============================================================================
-- CALENDAR_CONNECTIONS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.calendar_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  provider text NOT NULL CHECK (provider IN ('google', 'outlook')),
  access_token_encrypted text,
  refresh_token_encrypted text,
  expires_at timestamptz,
  calendar_id text,
  email_address text NOT NULL,
  is_active boolean DEFAULT true,
  last_sync_at timestamptz,
  sync_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, provider, email_address)
);

COMMENT ON TABLE public.calendar_connections IS
  'Stores OAuth connections for calendar providers (Google Calendar, Outlook)';
COMMENT ON COLUMN public.calendar_connections.provider IS
  'Calendar provider: google or outlook';
COMMENT ON COLUMN public.calendar_connections.access_token_encrypted IS
  'Encrypted OAuth access token';
COMMENT ON COLUMN public.calendar_connections.refresh_token_encrypted IS
  'Encrypted OAuth refresh token for obtaining new access tokens';
COMMENT ON COLUMN public.calendar_connections.expires_at IS
  'When the access token expires';
COMMENT ON COLUMN public.calendar_connections.calendar_id IS
  'Primary calendar ID from the provider';
COMMENT ON COLUMN public.calendar_connections.email_address IS
  'Email address associated with the calendar account';
COMMENT ON COLUMN public.calendar_connections.is_active IS
  'Whether this connection is currently active';
COMMENT ON COLUMN public.calendar_connections.last_sync_at IS
  'Timestamp of last successful calendar sync';
COMMENT ON COLUMN public.calendar_connections.sync_error IS
  'Error message from last failed sync attempt, if any';

-- Enable Row Level Security
ALTER TABLE public.calendar_connections ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only manage their own calendar connections
CREATE POLICY "Users can manage own calendar connections"
  ON public.calendar_connections
  FOR ALL
  USING (auth.uid() = user_id);

-- Add trigger for auto-updating updated_at
CREATE TRIGGER update_calendar_connections_updated_at
  BEFORE UPDATE ON public.calendar_connections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================================================
-- CALENDAR_EVENTS TABLE (cached events)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL REFERENCES public.calendar_connections(id) ON DELETE CASCADE,
  provider_id text NOT NULL,
  title text,
  description text,
  location text,
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  is_all_day boolean DEFAULT false,
  status text CHECK (status IS NULL OR status IN ('confirmed', 'tentative', 'cancelled')),
  organizer text,
  attendees jsonb,
  recurrence text,
  ai_summary text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(connection_id, provider_id)
);

COMMENT ON TABLE public.calendar_events IS
  'Cached calendar events synced from external providers';
COMMENT ON COLUMN public.calendar_events.connection_id IS
  'Reference to the calendar connection this event belongs to';
COMMENT ON COLUMN public.calendar_events.provider_id IS
  'Unique event ID from the calendar provider';
COMMENT ON COLUMN public.calendar_events.title IS
  'Event title/summary';
COMMENT ON COLUMN public.calendar_events.description IS
  'Full event description';
COMMENT ON COLUMN public.calendar_events.location IS
  'Event location (physical or virtual)';
COMMENT ON COLUMN public.calendar_events.start_at IS
  'Event start time (stored in UTC)';
COMMENT ON COLUMN public.calendar_events.end_at IS
  'Event end time (stored in UTC)';
COMMENT ON COLUMN public.calendar_events.is_all_day IS
  'Whether this is an all-day event';
COMMENT ON COLUMN public.calendar_events.status IS
  'Event status: confirmed, tentative, or cancelled';
COMMENT ON COLUMN public.calendar_events.organizer IS
  'Email address of the event organizer';
COMMENT ON COLUMN public.calendar_events.attendees IS
  'JSON array of attendees with email, name, and response status';
COMMENT ON COLUMN public.calendar_events.recurrence IS
  'Recurrence rule (RRULE format) if this is a recurring event';
COMMENT ON COLUMN public.calendar_events.ai_summary IS
  'AI-generated summary of the event';

-- Enable Row Level Security
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only read their own calendar events (through connection ownership)
CREATE POLICY "Users can read own calendar events"
  ON public.calendar_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.calendar_connections cc
      WHERE cc.id = calendar_events.connection_id
        AND cc.user_id = auth.uid()
    )
  );

-- RLS Policy: Users can insert their own calendar events (through connection ownership)
CREATE POLICY "Users can insert own calendar events"
  ON public.calendar_events
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.calendar_connections cc
      WHERE cc.id = calendar_events.connection_id
        AND cc.user_id = auth.uid()
    )
  );

-- RLS Policy: Users can update their own calendar events (through connection ownership)
CREATE POLICY "Users can update own calendar events"
  ON public.calendar_events
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.calendar_connections cc
      WHERE cc.id = calendar_events.connection_id
        AND cc.user_id = auth.uid()
    )
  );

-- RLS Policy: Users can delete their own calendar events (through connection ownership)
CREATE POLICY "Users can delete own calendar events"
  ON public.calendar_events
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.calendar_connections cc
      WHERE cc.id = calendar_events.connection_id
        AND cc.user_id = auth.uid()
    )
  );

-- =============================================================================
-- INDEXES FOR PERFORMANCE
-- =============================================================================

-- Index for looking up events by connection
CREATE INDEX idx_calendar_events_connection_id
  ON public.calendar_events(connection_id);

-- Index for filtering events by date range (common query pattern)
CREATE INDEX idx_calendar_events_start_at
  ON public.calendar_events(start_at);

-- Index for looking up events by time range
CREATE INDEX idx_calendar_events_date_range
  ON public.calendar_events(connection_id, start_at, end_at);

-- Index for looking up connections by user
CREATE INDEX idx_calendar_connections_user_id
  ON public.calendar_connections(user_id);

-- Index for looking up active connections
CREATE INDEX idx_calendar_connections_user_active
  ON public.calendar_connections(user_id, is_active)
  WHERE is_active = true;
