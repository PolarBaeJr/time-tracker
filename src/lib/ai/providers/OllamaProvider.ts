import { AIProvider, AIProviderConfig, ChatMessage, AIOptions, AIResponse } from '../types';

const DEFAULT_BASE_URL = 'http://localhost:11434';

/**
 * Ollama provider — runs entirely on the user's local machine.
 * No API key is required. All requests stay on localhost.
 */
export class OllamaProvider implements AIProvider {
  id = 'ollama' as const;
  name = 'Ollama (Local)';
  defaultModel = 'llama3';
  availableModels: string[] = [];

  private baseUrl: string;
  private model: string;

  constructor(config: AIProviderConfig) {
    this.baseUrl = (config.baseUrl || DEFAULT_BASE_URL).replace(/\/$/, '');
    this.model = config.model || this.defaultModel;
  }

  async chat(messages: ChatMessage[], options?: AIOptions): Promise<AIResponse> {
    const allMessages: { role: string; content: string }[] = [];

    if (options?.systemPrompt) {
      allMessages.push({ role: 'system', content: options.systemPrompt });
    }

    for (const m of messages) {
      if (m.role === 'system' && options?.systemPrompt) continue;
      allMessages.push({ role: m.role, content: m.content });
    }

    const body: Record<string, unknown> = {
      model: this.model,
      messages: allMessages,
      stream: false,
    };

    if (options?.temperature !== undefined) {
      body.options = { temperature: options.temperature };
    }

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch (err) {
      throw new Error(
        'Failed to connect to Ollama. Make sure Ollama is running on your machine (' +
        this.baseUrl + ').'
      );
    }

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      if (response.status === 404) {
        throw new Error(`Model "${this.model}" not found. Run "ollama pull ${this.model}" to download it.`);
      }
      throw new Error(`Ollama error (${response.status}): ${text}`);
    }

    const data = await response.json();

    return {
      content: data.message?.content ?? '',
      usage: data.prompt_eval_count != null ? {
        inputTokens: data.prompt_eval_count,
        outputTokens: data.eval_count ?? 0,
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
      const response = await fetch(`${this.baseUrl}/api/tags`);
      if (response.ok) {
        const data = await response.json();
        this.availableModels = (data.models ?? []).map(
          (m: { name: string }) => m.name
        );
      }
      return response.ok;
    } catch {
      return false;
    }
  }
}
