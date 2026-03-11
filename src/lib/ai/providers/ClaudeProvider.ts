import { AIProvider, AIProviderConfig, ChatMessage, AIOptions, AIResponse } from '../types';

const API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

export class ClaudeProvider implements AIProvider {
  id = 'claude' as const;
  name = 'Claude';
  defaultModel = 'claude-sonnet-4-20250514';
  availableModels = [
    'claude-sonnet-4-20250514',
    'claude-opus-4-20250514',
    'claude-haiku-4-5-20251001',
  ];

  private apiKey: string;
  private model: string;

  constructor(config: AIProviderConfig) {
    this.apiKey = config.apiKey;
    this.model = config.model || this.defaultModel;
  }

  async chat(messages: ChatMessage[], options?: AIOptions): Promise<AIResponse> {
    const systemPrompt = options?.systemPrompt
      || messages.find(m => m.role === 'system')?.content;

    const filteredMessages = messages.filter(m => m.role !== 'system');

    const body: Record<string, unknown> = {
      model: this.model,
      max_tokens: options?.maxTokens ?? 1024,
      messages: filteredMessages.map(m => ({ role: m.role, content: m.content })),
    };

    if (systemPrompt) {
      body.system = systemPrompt;
    }
    if (options?.temperature !== undefined) {
      body.temperature = options.temperature;
    }

    let response: Response;
    try {
      response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': ANTHROPIC_VERSION,
        },
        body: JSON.stringify(body),
      });
    } catch (err) {
      throw new Error('Failed to connect to Claude API. Please check your internet connection.');
    }

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      if (response.status === 401) {
        throw new Error('Invalid Claude API key. Please check your key in Settings.');
      }
      if (response.status === 429) {
        throw new Error('Claude rate limit reached. Please wait a moment and try again.');
      }
      throw new Error(`Claude API error (${response.status}): ${text}`);
    }

    const data = await response.json();

    const content = data.content
      ?.filter((block: { type: string }) => block.type === 'text')
      .map((block: { text: string }) => block.text)
      .join('') ?? '';

    return {
      content,
      usage: data.usage ? {
        inputTokens: data.usage.input_tokens,
        outputTokens: data.usage.output_tokens,
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
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': ANTHROPIC_VERSION,
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: 1,
          messages: [{ role: 'user', content: 'hi' }],
        }),
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}
