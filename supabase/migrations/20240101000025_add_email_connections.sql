-- Migration: Email Connections and Messages
-- Adds support for email integration (Gmail, Outlook, IMAP)

-- =============================================================================
-- EMAIL_CONNECTIONS TABLE
-- Stores OAuth tokens and configuration for email providers
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.email_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  provider text NOT NULL CHECK (provider IN ('gmail', 'outlook', 'imap')),
  -- OAuth fields (for Gmail/Outlook)
  access_token_encrypted text,
  refresh_token_encrypted text,
  expires_at timestamptz,
  -- IMAP fields
  imap_server text,
  imap_port int,
  imap_username text,
  imap_password_encrypted text,
  -- Common fields
  email_address text NOT NULL,
  is_active boolean DEFAULT true,
  last_sync_at timestamptz,
  sync_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- One email address per user
  UNIQUE(user_id, email_address)
);

COMMENT ON TABLE public.email_connections IS
    'Stores email provider connections for Gmail, Outlook, and IMAP accounts';

COMMENT ON COLUMN public.email_connections.provider IS
    'Email provider type: gmail, outlook, or imap';

COMMENT ON COLUMN public.email_connections.access_token_encrypted IS
    'Encrypted OAuth access token (for Gmail/Outlook)';

COMMENT ON COLUMN public.email_connections.refresh_token_encrypted IS
    'Encrypted OAuth refresh token (for Gmail/Outlook)';

COMMENT ON COLUMN public.email_connections.expires_at IS
    'OAuth token expiration timestamp (for Gmail/Outlook)';

COMMENT ON COLUMN public.email_connections.imap_password_encrypted IS
    'Encrypted IMAP password (for IMAP connections only)';

COMMENT ON COLUMN public.email_connections.last_sync_at IS
    'Timestamp of last successful email sync';

COMMENT ON COLUMN public.email_connections.sync_error IS
    'Last sync error message, if any';

-- =============================================================================
-- EMAIL_MESSAGES TABLE
-- Cached email messages from connected accounts
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.email_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL REFERENCES public.email_connections(id) ON DELETE CASCADE,
  provider_id text NOT NULL,
  subject text,
  sender text,
  sender_name text,
  received_at timestamptz,
  snippet text,
  is_read boolean DEFAULT false,
  is_starred boolean DEFAULT false,
  labels text[] DEFAULT '{}',
  ai_summary text,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- One message per provider ID per connection
  UNIQUE(connection_id, provider_id)
);

COMMENT ON TABLE public.email_messages IS
    'Cached email messages synced from connected email accounts';

COMMENT ON COLUMN public.email_messages.provider_id IS
    'Message ID from the email provider (Gmail message ID, Outlook message ID, etc.)';

COMMENT ON COLUMN public.email_messages.snippet IS
    'Preview text snippet of the email body';

COMMENT ON COLUMN public.email_messages.labels IS
    'Array of labels/folders assigned to the message';

COMMENT ON COLUMN public.email_messages.ai_summary IS
    'AI-generated summary of the email content';

-- =============================================================================
-- INDEXES
-- =============================================================================

-- Index for looking up connections by user
CREATE INDEX idx_email_connections_user_id ON public.email_connections(user_id);

-- Index for looking up messages by connection
CREATE INDEX idx_email_messages_connection_id ON public.email_messages(connection_id);

-- Index for sorting messages by received date
CREATE INDEX idx_email_messages_received_at ON public.email_messages(received_at DESC);

-- Index for filtering unread messages
CREATE INDEX idx_email_messages_is_read ON public.email_messages(connection_id, is_read)
  WHERE is_read = false;

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE public.email_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_messages ENABLE ROW LEVEL SECURITY;

-- Users can only manage their own email connections
CREATE POLICY "Users can manage own email connections"
  ON public.email_connections
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

COMMENT ON POLICY "Users can manage own email connections" ON public.email_connections IS
    'Users can only create, read, update, and delete their own email connections';

-- Users can only read their own email messages (via connection ownership)
-- This requires a subquery to check connection ownership
CREATE POLICY "Users can read own email messages"
  ON public.email_messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.email_connections ec
      WHERE ec.id = email_messages.connection_id
        AND ec.user_id = auth.uid()
    )
  );

COMMENT ON POLICY "Users can read own email messages" ON public.email_messages IS
    'Users can only read messages from their own email connections';

-- Users can insert messages for their own connections
CREATE POLICY "Users can insert own email messages"
  ON public.email_messages
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.email_connections ec
      WHERE ec.id = email_messages.connection_id
        AND ec.user_id = auth.uid()
    )
  );

COMMENT ON POLICY "Users can insert own email messages" ON public.email_messages IS
    'Users can only insert messages for their own email connections';

-- Users can update messages for their own connections (e.g., marking as read)
CREATE POLICY "Users can update own email messages"
  ON public.email_messages
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.email_connections ec
      WHERE ec.id = email_messages.connection_id
        AND ec.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.email_connections ec
      WHERE ec.id = email_messages.connection_id
        AND ec.user_id = auth.uid()
    )
  );

COMMENT ON POLICY "Users can update own email messages" ON public.email_messages IS
    'Users can only update messages from their own email connections';

-- Users can delete messages for their own connections
CREATE POLICY "Users can delete own email messages"
  ON public.email_messages
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.email_connections ec
      WHERE ec.id = email_messages.connection_id
        AND ec.user_id = auth.uid()
    )
  );

COMMENT ON POLICY "Users can delete own email messages" ON public.email_messages IS
    'Users can only delete messages from their own email connections';

-- =============================================================================
-- TRIGGERS
-- =============================================================================

-- Auto-update updated_at timestamp on email_connections
CREATE TRIGGER update_email_connections_updated_at
  BEFORE UPDATE ON public.email_connections
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- =============================================================================
-- SECURITY NOTES
-- =============================================================================

/*
SECURITY CONSIDERATIONS:

1. TOKEN ENCRYPTION: OAuth tokens and IMAP passwords are stored in _encrypted
   fields. The application layer is responsible for encrypting these values
   before storage and decrypting them when needed.

2. RLS FOR MESSAGES: email_messages uses a subquery-based RLS policy that
   checks connection ownership. This ensures users can only access messages
   from their own connected accounts.

3. CASCADING DELETES: When an email_connection is deleted, all associated
   email_messages are automatically deleted via ON DELETE CASCADE.

4. NO DIRECT MESSAGE MANIPULATION: End users should interact with messages
   through the application layer (sync functions), not directly via SQL.
   The RLS policies support this but enforce ownership checks.

5. SENSITIVE DATA: This table contains sensitive authentication tokens.
   Ensure proper access controls at the application level and consider
   audit logging for token access.
*/
