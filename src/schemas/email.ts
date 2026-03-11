import { z } from 'zod';

/**
 * Email Schema - Zod schemas for email integration
 *
 * Supports Gmail (OAuth), Outlook (OAuth), and IMAP email providers.
 * Used for storing email connections and caching email messages.
 */

/**
 * Email Provider Enum - Supported email providers
 */
export const EmailProviderEnum = z.enum(['gmail', 'outlook', 'imap']);

export type EmailProvider = z.infer<typeof EmailProviderEnum>;

/**
 * Email Connection Schema - Entity schema for query responses
 *
 * Represents a user's email connection stored in the email_connections table.
 * Sensitive fields (tokens, passwords) are NOT included as they should
 * never be returned to the client.
 */
export const EmailConnectionSchema = z.object({
  /** UUID primary key */
  id: z.string().uuid(),

  /** UUID of the owning user */
  user_id: z.string().uuid(),

  /** Email provider type */
  provider: EmailProviderEnum,

  /** User's email address for this connection */
  email_address: z.string().email(),

  /** Whether this connection is active */
  is_active: z.boolean(),

  /** Timestamp of last successful sync */
  last_sync_at: z.string().datetime({ offset: true }).nullable(),

  /** Error message from last sync attempt (null if successful) */
  sync_error: z.string().nullable(),

  /** Timestamp when connection was created */
  created_at: z.string().datetime({ offset: true }),

  /** Timestamp when connection was last updated */
  updated_at: z.string().datetime({ offset: true }),
});

export type EmailConnection = z.infer<typeof EmailConnectionSchema>;

/**
 * Create Email Connection OAuth Schema - For Gmail/Outlook OAuth connections
 *
 * Used when connecting Gmail or Outlook via OAuth flow.
 * Tokens will be encrypted server-side before storage.
 */
export const CreateEmailConnectionOAuthSchema = z.object({
  /** Provider type (OAuth providers only) */
  provider: z.enum(['gmail', 'outlook']),

  /** OAuth access token */
  access_token: z.string().min(1, 'Access token is required'),

  /** OAuth refresh token for token renewal */
  refresh_token: z.string().min(1, 'Refresh token is required'),

  /** Token expiration time in seconds */
  expires_in: z.number().int().positive('Expiration time must be positive'),

  /** User's email address from OAuth profile */
  email_address: z.string().email('Valid email address is required'),
});

export type CreateEmailConnectionOAuthInput = z.infer<typeof CreateEmailConnectionOAuthSchema>;

/**
 * Create Email Connection IMAP Schema - For IMAP connections
 *
 * Used when connecting via IMAP protocol (generic email servers).
 * Password will be encrypted server-side before storage.
 */
export const CreateEmailConnectionIMAPSchema = z.object({
  /** Provider type (must be 'imap') */
  provider: z.literal('imap'),

  /** IMAP server hostname */
  imap_server: z.string().min(1, 'IMAP server is required'),

  /** IMAP server port (typically 993 for SSL, 143 for STARTTLS) */
  imap_port: z
    .number()
    .int()
    .min(1, 'Port must be at least 1')
    .max(65535, 'Port must not exceed 65535'),

  /** IMAP username (often the email address) */
  imap_username: z.string().min(1, 'IMAP username is required'),

  /** IMAP password or app-specific password */
  imap_password: z.string().min(1, 'IMAP password is required'),

  /** User's email address */
  email_address: z.string().email('Valid email address is required'),
});

export type CreateEmailConnectionIMAPInput = z.infer<typeof CreateEmailConnectionIMAPSchema>;

/**
 * Combined Create Email Connection Schema - Union of OAuth and IMAP schemas
 */
export const CreateEmailConnectionSchema = z.discriminatedUnion('provider', [
  CreateEmailConnectionOAuthSchema.extend({ provider: z.literal('gmail') }),
  CreateEmailConnectionOAuthSchema.extend({ provider: z.literal('outlook') }),
  CreateEmailConnectionIMAPSchema,
]);

export type CreateEmailConnectionInput = z.infer<typeof CreateEmailConnectionSchema>;

/**
 * Email Message Schema - Entity schema for cached email messages
 *
 * Represents an email message cached from the provider.
 * Messages are synced periodically and stored locally for faster access.
 */
export const EmailMessageSchema = z.object({
  /** UUID primary key */
  id: z.string().uuid(),

  /** UUID of the associated email connection */
  connection_id: z.string().uuid(),

  /** Message ID from the email provider (unique per provider) */
  provider_id: z.string(),

  /** Email subject (may be null for no-subject emails) */
  subject: z.string().nullable(),

  /** Sender's email address */
  sender: z.string(),

  /** Sender's display name (if available) */
  sender_name: z.string().nullable(),

  /** Timestamp when email was received */
  received_at: z.string().datetime({ offset: true }),

  /** Email snippet/preview (first ~200 chars of body) */
  snippet: z.string().nullable(),

  /** Whether the email has been read */
  is_read: z.boolean(),

  /** Whether the email is starred/flagged */
  is_starred: z.boolean(),

  /** Email labels/folders (e.g., 'INBOX', 'IMPORTANT') */
  labels: z.array(z.string()),

  /** AI-generated summary (null if not yet summarized) */
  ai_summary: z.string().nullable(),
});

export type EmailMessage = z.infer<typeof EmailMessageSchema>;

/**
 * Email Messages List Schema - For paginated email responses
 */
export const EmailMessagesListSchema = z.object({
  /** Array of email messages */
  messages: z.array(EmailMessageSchema),

  /** Whether there are more messages to fetch */
  has_more: z.boolean(),

  /** Token for fetching next page (if has_more is true) */
  next_page_token: z.string().optional(),

  /** Total count of messages (if available) */
  total_count: z.number().int().nonnegative().optional(),
});

export type EmailMessagesList = z.infer<typeof EmailMessagesListSchema>;

/**
 * Email Sync Options Schema - Options for syncing emails
 */
export const EmailSyncOptionsSchema = z.object({
  /** Maximum number of messages to sync */
  max_results: z.number().int().positive().max(100).default(50),

  /** Only sync messages after this date */
  since: z.string().datetime({ offset: true }).optional(),

  /** Label IDs to filter by (provider-specific) */
  label_ids: z.array(z.string()).optional(),
});

export type EmailSyncOptions = z.infer<typeof EmailSyncOptionsSchema>;

/**
 * Email Sync Result Schema - Result of a sync operation
 */
export const EmailSyncResultSchema = z.object({
  /** Whether sync was successful */
  success: z.boolean(),

  /** Number of messages synced */
  message_count: z.number().int().nonnegative(),

  /** Error message if sync failed */
  error: z.string().optional(),

  /** Timestamp of this sync */
  synced_at: z.string().datetime({ offset: true }),
});

export type EmailSyncResult = z.infer<typeof EmailSyncResultSchema>;
