export { aiEngine } from './AIEngine';
export type {
  AIProvider,
  AIProviderType,
  AIProviderConfig,
  ChatMessage,
  AIOptions,
  AIResponse,
  SummarizationOptions,
} from './types';

// Email and Calendar summarization functions
export {
  summarizeEmails,
  summarizeEmail,
  summarizeCalendarDay,
  summarizeEvent,
  sanitizeForAI,
} from './summarization';

// AI Context Builder for chat assistant
export { buildTimeTrackingContext, getSystemPrompt, formatDuration } from './contextBuilder';
