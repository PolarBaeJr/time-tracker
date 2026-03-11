# 02 - AI Engine (Multi-Provider Abstraction)

## Phase: 1 (Foundation)

## Summary

A provider-agnostic AI abstraction layer that supports Claude (Anthropic), OpenAI, and local LLMs (Ollama). Users choose their provider and enter their API key in Settings. All AI features (email summarization, chat, task creation, etc.) use this single engine.

## Architecture

```
src/
  lib/
    ai/
      AIEngine.ts             # Main abstraction class
      providers/
        ClaudeProvider.ts     # Anthropic Claude API
        OpenAIProvider.ts     # OpenAI API
        OllamaProvider.ts     # Local Ollama instance
      types.ts                # Shared types
      prompts/
        emailSummary.ts       # Email summarization prompt
        dailyDigest.ts        # Morning briefing prompt
        taskExtraction.ts     # Natural language -> task
        timeInsights.ts       # Time tracking analysis
        meetingPrep.ts        # Calendar event prep notes
        articleSummary.ts     # News article summary
  hooks/
    useAI.ts                  # React hook for AI operations
    useAISettings.ts          # Provider config management
  components/
    settings/
      AISettings.tsx          # AI provider configuration UI
```

## Provider Interface

```typescript
interface AIProvider {
  id: 'claude' | 'openai' | 'ollama';
  name: string;

  // Core methods
  chat(messages: ChatMessage[], options?: AIOptions): Promise<AIResponse>;
  streamChat(messages: ChatMessage[], options?: AIOptions): AsyncIterable<string>;
  summarize(text: string, options?: SummarizeOptions): Promise<string>;

  // Capabilities
  supportsStreaming: boolean;
  supportsVision: boolean;
  maxTokens: number;

  // Lifecycle
  initialize(config: ProviderConfig): Promise<void>;
  validateKey(): Promise<boolean>;
}

interface ProviderConfig {
  apiKey: string;           // User's API key
  model?: string;           // Optional model override
  baseUrl?: string;         // For Ollama: http://localhost:11434
  maxTokensPerRequest?: number;
}

interface AIOptions {
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  stream?: boolean;
}

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}
```

## Provider Implementations

### Claude (Anthropic)
- API: `https://api.anthropic.com/v1/messages`
- Models: claude-sonnet-4-20250514 (default), claude-opus-4-20250514 (for complex tasks)
- Supports streaming, vision
- SDK: `@anthropic-ai/sdk`

### OpenAI
- API: `https://api.openai.com/v1/chat/completions`
- Models: gpt-4o (default), gpt-4o-mini (for fast tasks)
- Supports streaming, vision
- SDK: `openai`

### Ollama (Local — runs on USER'S device, not the server)
- API: `http://localhost:11434/api/chat` (user's machine)
- Requests go directly from user's browser/Electron to their local Ollama instance
- Zero load on the Pi server — only stores connection config (base_url, model preference)
- Models: user-configured (llama3, mistral, etc.)
- Supports streaming, no vision (model-dependent)
- No SDK needed, plain fetch
- **Important**: On web (non-Electron), localhost refers to user's machine — this works. On mobile, user must enter their machine's LAN IP (e.g., `http://192.168.1.x:11434`)

## API Key Storage

Keys stored in Supabase `ai_connections` table (new):

```sql
CREATE TABLE ai_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL DEFAULT auth.uid(),
  provider TEXT NOT NULL,           -- 'claude' | 'openai' | 'ollama'
  api_key_encrypted TEXT,           -- Encrypted API key (null for Ollama)
  model TEXT,                       -- Preferred model
  base_url TEXT,                    -- Custom URL (Ollama)
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, provider)
);

-- RLS: users can only access their own keys
ALTER TABLE ai_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own AI connections"
  ON ai_connections FOR ALL USING (auth.uid() = user_id);
```

### Encryption Strategy

- API keys encrypted client-side before storing in Supabase
- Encryption key derived from user's Supabase auth token (changes on session refresh)
- Alternative: use `pgcrypto` extension for server-side encryption with a per-user salt
- Keys decrypted only in memory when making API calls
- **Never log or expose API keys in error messages**

## Settings UI

```
AI Assistant Settings
─────────────────────
Provider:  [Claude v] [OpenAI] [Ollama]

API Key:   [••••••••••••••••] [Test]
Model:     [claude-sonnet-4-20250514    v]

Status:    ✓ Connected (last tested 2 min ago)

Usage:     ~$0.12 today (estimated)

[Disconnect]
```

## Rate Limiting & Cost Control

- Track token usage per request (stored locally)
- Show estimated daily cost in settings
- Optional daily spending cap (warn when approaching)
- Implement request queue with debouncing for auto-features (e.g., email summarization)
- Cache AI responses (TanStack Query with 10min staleTime for summaries)

## Error Handling

- Invalid API key: Clear error message, link to provider's key page
- Rate limited: Back off with exponential retry, show "AI busy" state
- Network error: Queue request for retry, show cached result if available
- Ollama not running: Detect connection failure, show setup instructions
- Provider down: Fall back to cached responses, show banner
