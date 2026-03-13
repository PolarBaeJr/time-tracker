-- Migration: Add chat conversations and messages for AI assistant
-- Creates chat_conversations and chat_messages tables with proper RLS

-- =============================================================================
-- CHAT ROLE ENUM TYPE
-- =============================================================================

-- Create enum for chat message roles
CREATE TYPE chat_role AS ENUM ('user', 'assistant', 'system');

COMMENT ON TYPE chat_role IS 'Role of a chat message: user (human), assistant (AI), or system (context/instructions)';

-- =============================================================================
-- CHAT CONVERSATIONS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.chat_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title text CHECK (title IS NULL OR char_length(title) <= 200),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.chat_conversations IS 'Chat conversations between users and AI assistant';
COMMENT ON COLUMN public.chat_conversations.title IS 'Conversation title, auto-generated from first message';

-- =============================================================================
-- CHAT MESSAGES TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  role chat_role NOT NULL,
  content text NOT NULL CHECK (char_length(content) <= 50000),
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.chat_messages IS 'Individual messages within chat conversations';
COMMENT ON COLUMN public.chat_messages.role IS 'Role of message sender: user, assistant, or system';
COMMENT ON COLUMN public.chat_messages.content IS 'Message content (max 50000 chars)';

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

-- Enable RLS on both tables
ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- User isolation policies - users can only access their own conversations and messages
CREATE POLICY "Users can manage own chat conversations"
  ON public.chat_conversations
  FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own chat messages"
  ON public.chat_messages
  FOR ALL
  USING (auth.uid() = user_id);

-- =============================================================================
-- INDEXES
-- =============================================================================

-- Index on user_id for both tables for efficient user lookups
CREATE INDEX idx_chat_conversations_user_id ON public.chat_conversations(user_id);
CREATE INDEX idx_chat_messages_user_id ON public.chat_messages(user_id);

-- Composite index for fetching messages in conversation order
CREATE INDEX idx_chat_messages_conversation_created
  ON public.chat_messages(conversation_id, created_at ASC);

-- =============================================================================
-- TRIGGERS
-- =============================================================================

-- Trigger to auto-update updated_at on chat_conversations
CREATE TRIGGER trigger_chat_conversations_updated_at
  BEFORE UPDATE ON public.chat_conversations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Trigger to update conversation.updated_at when a message is added
CREATE OR REPLACE FUNCTION update_conversation_on_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  UPDATE public.chat_conversations
  SET updated_at = now()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION update_conversation_on_message() IS
  'Updates conversation updated_at timestamp when a new message is added';

CREATE TRIGGER trigger_chat_message_update_conversation
  AFTER INSERT ON public.chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_conversation_on_message();

-- =============================================================================
-- SECURITY NOTES
-- =============================================================================

/*
SECURITY CONSIDERATIONS:

1. RLS Policies:
   - Both tables have user isolation policies ensuring users can only
     access their own conversations and messages
   - Uses auth.uid() = user_id check for all operations

2. Foreign Key Cascades:
   - ON DELETE CASCADE on user_id ensures cleanup when user is deleted
   - ON DELETE CASCADE on conversation_id ensures messages are deleted
     when conversation is deleted

3. Content Limits:
   - Title limited to 200 chars via CHECK constraint
   - Message content limited to 50000 chars via CHECK constraint
   - These prevent resource exhaustion attacks

4. update_conversation_on_message():
   - Does NOT use SECURITY DEFINER - runs as calling user
   - SET search_path = public prevents search_path injection
   - Only updates the conversation the message belongs to
*/
