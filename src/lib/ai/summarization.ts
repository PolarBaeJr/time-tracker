/**
 * AI Summarization Service for Email and Calendar
 *
 * Provides functions for generating AI-powered summaries of emails and calendar events.
 * Uses the configured AI engine (Claude, OpenAI, or Ollama) for text processing.
 */

import type { EmailMessage } from '@/schemas/email';
import type { CalendarEvent } from '@/schemas/calendar';

/**
 * Configuration options for summarization
 */
export interface SummarizationOptions {
  /** Maximum length of output in characters (default: 500) */
  maxLength?: number;
  /** Summary style: 'brief' for short summaries, 'detailed' for longer ones */
  style?: 'brief' | 'detailed';
}

// Default configuration values
const DEFAULT_MAX_LENGTH = 500;
const SANITIZE_MAX_LENGTH = 1000;

/**
 * Patterns that could be used for prompt injection attacks
 */
const PROMPT_INJECTION_PATTERNS = [
  /ignore\s+(previous|all|above)\s+(instructions?|prompts?)/gi,
  /you\s+are\s+now\s+/gi,
  /forget\s+(everything|all)/gi,
  /new\s+instructions?:/gi,
  /system\s*:\s*/gi,
  /\[INST\]/gi,
  /\[\/INST\]/gi,
  /<\|im_start\|>/gi,
  /<\|im_end\|>/gi,
];

/**
 * Sanitize content for AI processing
 *
 * Removes HTML tags, truncates to max length, and removes potential prompt injection patterns.
 *
 * @param content - The content to sanitize
 * @param maxLength - Maximum length after sanitization (default: 1000)
 * @returns Sanitized content safe for AI processing
 */
export function sanitizeForAI(content: string, maxLength: number = SANITIZE_MAX_LENGTH): string {
  if (!content) return '';

  let sanitized = content;

  // Remove HTML tags
  sanitized = sanitized.replace(/<[^>]*>/g, ' ');

  // Decode HTML entities
  sanitized = sanitized
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  // Remove potential prompt injection patterns
  for (const pattern of PROMPT_INJECTION_PATTERNS) {
    sanitized = sanitized.replace(pattern, '[filtered]');
  }

  // Normalize whitespace
  sanitized = sanitized.replace(/\s+/g, ' ').trim();

  // Truncate to max length
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength - 3) + '...';
  }

  return sanitized;
}

/**
 * Format an email for summarization context
 */
function formatEmailForPrompt(email: EmailMessage): string {
  const parts: string[] = [];

  if (email.sender_name) {
    parts.push(`From: ${sanitizeForAI(email.sender_name, 100)} <${email.sender}>`);
  } else {
    parts.push(`From: ${email.sender}`);
  }

  if (email.subject) {
    parts.push(`Subject: ${sanitizeForAI(email.subject, 200)}`);
  }

  if (email.snippet) {
    parts.push(`Preview: ${sanitizeForAI(email.snippet, 300)}`);
  }

  const flags: string[] = [];
  if (!email.is_read) flags.push('unread');
  if (email.is_starred) flags.push('starred');
  if (flags.length > 0) {
    parts.push(`Status: ${flags.join(', ')}`);
  }

  return parts.join('\n');
}

/**
 * Format a calendar event for summarization context
 */
function formatEventForPrompt(event: CalendarEvent): string {
  const parts: string[] = [];

  if (event.title) {
    parts.push(`Event: ${sanitizeForAI(event.title, 200)}`);
  } else {
    parts.push('Event: (Untitled)');
  }

  // Format time
  const startDate = new Date(event.start_at);
  const endDate = new Date(event.end_at);

  if (event.is_all_day) {
    parts.push(`When: All day`);
  } else {
    const timeOptions: Intl.DateTimeFormatOptions = {
      hour: '2-digit',
      minute: '2-digit',
    };
    const startTime = startDate.toLocaleTimeString(undefined, timeOptions);
    const endTime = endDate.toLocaleTimeString(undefined, timeOptions);
    parts.push(`When: ${startTime} - ${endTime}`);
  }

  if (event.location) {
    parts.push(`Location: ${sanitizeForAI(event.location, 100)}`);
  }

  if (event.description) {
    parts.push(`Description: ${sanitizeForAI(event.description, 200)}`);
  }

  if (event.attendees && event.attendees.length > 0) {
    const attendeeCount = event.attendees.length;
    parts.push(`Attendees: ${attendeeCount} ${attendeeCount === 1 ? 'person' : 'people'}`);
  }

  if (event.status && event.status !== 'confirmed') {
    parts.push(`Status: ${event.status}`);
  }

  return parts.join('\n');
}

/**
 * Get the AIEngine type for type safety
 * We use a simplified type since we need to reference the class dynamically
 */
type AIEngineInstance = {
  isConfigured: boolean;
  chat: (
    messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
    options?: { systemPrompt?: string; maxTokens?: number; temperature?: number }
  ) => Promise<{ content: string }>;
};

/**
 * Summarize multiple emails
 *
 * Creates a brief summary of recent emails, focusing on what needs attention.
 *
 * @param emails - Array of email messages to summarize
 * @param aiEngine - The configured AI engine instance
 * @param options - Optional summarization options
 * @returns A brief summary of the emails
 * @throws Error if AI is not configured
 */
export async function summarizeEmails(
  emails: EmailMessage[],
  aiEngine: AIEngineInstance,
  options?: SummarizationOptions
): Promise<string> {
  if (!aiEngine.isConfigured) {
    throw new Error('AI not configured. Go to Settings > AI Assistant.');
  }

  if (emails.length === 0) {
    return 'No emails to summarize.';
  }

  const maxEmails = options?.style === 'detailed' ? 10 : 5;
  const emailsToSummarize = emails.slice(0, maxEmails);

  const emailContent = emailsToSummarize.map(formatEmailForPrompt).join('\n\n---\n\n');

  const prompt =
    options?.style === 'detailed'
      ? `You have ${emails.length} recent emails. Here are the most recent ones:\n\n${emailContent}\n\nProvide a detailed summary (3-4 sentences) of these emails, highlighting important senders, urgent items, and key topics.`
      : `Here are ${emails.length} recent emails:\n\n${emailContent}\n\nSummarize these emails in 2-3 sentences. Focus on what needs attention first.`;

  const result = await aiEngine.chat([{ role: 'user', content: prompt }], {
    systemPrompt:
      'You are a helpful assistant that summarizes emails concisely. Be brief and focus on actionable items.',
    maxTokens: options?.maxLength || DEFAULT_MAX_LENGTH,
    temperature: 0.3,
  });

  return result.content;
}

/**
 * Summarize a single email
 *
 * Creates a one-sentence summary of an email.
 *
 * @param email - The email message to summarize
 * @param aiEngine - The configured AI engine instance
 * @param options - Optional summarization options
 * @returns A one-sentence summary of the email
 * @throws Error if AI is not configured
 */
export async function summarizeEmail(
  email: EmailMessage,
  aiEngine: AIEngineInstance,
  options?: SummarizationOptions
): Promise<string> {
  if (!aiEngine.isConfigured) {
    throw new Error('AI not configured. Go to Settings > AI Assistant.');
  }

  const emailContent = formatEmailForPrompt(email);

  const prompt =
    options?.style === 'detailed'
      ? `Summarize this email in 2-3 sentences:\n\n${emailContent}`
      : `Summarize this email in one sentence:\n\n${emailContent}`;

  const result = await aiEngine.chat([{ role: 'user', content: prompt }], {
    systemPrompt: 'You are a helpful assistant that summarizes emails concisely.',
    maxTokens: options?.maxLength || 150,
    temperature: 0.3,
  });

  return result.content;
}

/**
 * Summarize today's calendar events
 *
 * Creates a brief summary of the day's schedule, highlighting important meetings.
 *
 * @param events - Array of today's calendar events
 * @param aiEngine - The configured AI engine instance
 * @param options - Optional summarization options
 * @returns A brief summary of today's schedule
 * @throws Error if AI is not configured
 */
export async function summarizeCalendarDay(
  events: CalendarEvent[],
  aiEngine: AIEngineInstance,
  options?: SummarizationOptions
): Promise<string> {
  if (!aiEngine.isConfigured) {
    throw new Error('AI not configured. Go to Settings > AI Assistant.');
  }

  if (events.length === 0) {
    return 'You have a free day - no events scheduled!';
  }

  // Sort events by start time
  const sortedEvents = [...events].sort(
    (a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime()
  );

  const maxEvents = options?.style === 'detailed' ? 15 : 8;
  const eventsToSummarize = sortedEvents.slice(0, maxEvents);

  const eventContent = eventsToSummarize.map(formatEventForPrompt).join('\n\n---\n\n');

  const prompt =
    options?.style === 'detailed'
      ? `You have ${events.length} events today. Here is your schedule:\n\n${eventContent}\n\nProvide a detailed summary (3-4 sentences) of today's schedule, highlighting important meetings, potential conflicts, and busy periods.`
      : `Here is today's schedule with ${events.length} events:\n\n${eventContent}\n\nSummarize today's schedule in 2-3 sentences. Highlight important meetings.`;

  const result = await aiEngine.chat([{ role: 'user', content: prompt }], {
    systemPrompt:
      'You are a helpful assistant that summarizes calendar schedules concisely. Be brief and highlight what requires attention.',
    maxTokens: options?.maxLength || DEFAULT_MAX_LENGTH,
    temperature: 0.3,
  });

  return result.content;
}

/**
 * Summarize a single calendar event
 *
 * Creates a one-sentence summary of a calendar event.
 *
 * @param event - The calendar event to summarize
 * @param aiEngine - The configured AI engine instance
 * @param options - Optional summarization options
 * @returns A one-sentence summary of the event
 * @throws Error if AI is not configured
 */
export async function summarizeEvent(
  event: CalendarEvent,
  aiEngine: AIEngineInstance,
  options?: SummarizationOptions
): Promise<string> {
  if (!aiEngine.isConfigured) {
    throw new Error('AI not configured. Go to Settings > AI Assistant.');
  }

  const eventContent = formatEventForPrompt(event);

  const prompt =
    options?.style === 'detailed'
      ? `Summarize this calendar event in 2-3 sentences:\n\n${eventContent}`
      : `Summarize this calendar event in one sentence:\n\n${eventContent}`;

  const result = await aiEngine.chat([{ role: 'user', content: prompt }], {
    systemPrompt: 'You are a helpful assistant that summarizes calendar events concisely.',
    maxTokens: options?.maxLength || 150,
    temperature: 0.3,
  });

  return result.content;
}
