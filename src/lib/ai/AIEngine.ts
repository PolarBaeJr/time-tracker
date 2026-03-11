import { AIProvider, AIProviderType, AIProviderConfig, ChatMessage, AIOptions, AIResponse } from './types';
import { ClaudeProvider } from './providers/ClaudeProvider';
import { OpenAIProvider } from './providers/OpenAIProvider';
import { OllamaProvider } from './providers/OllamaProvider';

class AIEngine {
  private provider: AIProvider | null = null;

  configure(type: AIProviderType, config: AIProviderConfig): void {
    switch (type) {
      case 'claude':
        this.provider = new ClaudeProvider(config);
        break;
      case 'openai':
        this.provider = new OpenAIProvider(config);
        break;
      case 'ollama':
        this.provider = new OllamaProvider(config);
        break;
    }
  }

  get isConfigured(): boolean {
    return this.provider !== null;
  }

  get activeProvider(): AIProvider | null {
    return this.provider;
  }

  async chat(messages: ChatMessage[], options?: AIOptions): Promise<AIResponse> {
    if (!this.provider) throw new Error('AI not configured. Go to Settings > AI Assistant.');
    return this.provider.chat(messages, options);
  }

  async summarize(text: string, options?: AIOptions): Promise<string> {
    if (!this.provider) throw new Error('AI not configured. Go to Settings > AI Assistant.');
    return this.provider.summarize(text, options);
  }

  async validateKey(): Promise<boolean> {
    if (!this.provider) return false;
    return this.provider.validateKey();
  }

  disconnect(): void {
    this.provider = null;
  }
}

export const aiEngine = new AIEngine();
