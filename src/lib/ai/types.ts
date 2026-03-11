export type AIProviderType = 'claude' | 'openai' | 'ollama';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface AIOptions {
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
}

export interface AIResponse {
  content: string;
  usage?: { inputTokens: number; outputTokens: number };
}

export interface AIProviderConfig {
  apiKey: string;
  model?: string;
  baseUrl?: string;
}

export interface AIProvider {
  id: AIProviderType;
  name: string;
  chat(messages: ChatMessage[], options?: AIOptions): Promise<AIResponse>;
  summarize(text: string, options?: AIOptions): Promise<string>;
  validateKey(): Promise<boolean>;
  defaultModel: string;
  availableModels: string[];
}
