import { AIProvider, AIProviderConfig, ChatMessage, AIOptions, AIResponse } from '../types';

const API_URL = 'https://api.openai.com/v1';

export class OpenAIProvider implements AIProvider {
  id = 'openai' as const;
  name = 'OpenAI';
  defaultModel = 'gpt-4o';
  availableModels = ['gpt-4o', 'gpt-4o-mini'];

  private apiKey: string;
  private model: string;

  constructor(config: AIProviderConfig) {
    this.apiKey = config.apiKey;
    this.model = config.model || this.defaultModel;
  }

  async chat(messages: ChatMessage[], options?: AIOptions): Promise<AIResponse> {
    const allMessages: { role: string; content: string }[] = [];

    if (options?.systemPrompt) {
      allMessages.push({ role: 'system', content: options.systemPrompt });
    }

    for (const m of messages) {
      // Skip system messages if we already added a systemPrompt
      if (m.role === 'system' && options?.systemPrompt) continue;
      allMessages.push({ role: m.role, content: m.content });
    }

    const body: Record<string, unknown> = {
      model: this.model,
      messages: allMessages,
    };

    if (options?.maxTokens !== undefined) {
      body.max_tokens = options.maxTokens;
    }
    if (options?.temperature !== undefined) {
      body.temperature = options.temperature;
    }

    let response: Response;
    try {
      response = await fetch(`${API_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
      });
    } catch (err) {
      throw new Error('Failed to connect to OpenAI API. Please check your internet connection.');
    }

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      if (response.status === 401) {
        throw new Error('Invalid OpenAI API key. Please check your key in Settings.');
      }
      if (response.status === 429) {
        throw new Error('OpenAI rate limit reached. Please wait a moment and try again.');
      }
      throw new Error(`OpenAI API error (${response.status}): ${text}`);
    }

    const data = await response.json();
    const choice = data.choices?.[0];

    return {
      content: choice?.message?.content ?? '',
      usage: data.usage ? {
        inputTokens: data.usage.prompt_tokens,
        outputTokens: data.usage.completion_tokens,
      } : undefined,
    };
  }

  async summarize(text: string, options?: AIOptions): Promise<string> {
    const result = await this.chat(
      [{ role: 'user', content: text }],
      {
        ...options,
        systemPrompt: options?.systemPrompt
          || 'You are a helpful assistant that summarizes text concisely. Provide a clear, brief summary of the following content.',
      },
    );
    return result.content;
  }

  async validateKey(): Promise<boolean> {
    try {
      const response = await fetch(`${API_URL}/models`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}
