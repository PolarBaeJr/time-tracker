/**
 * Email Schema Tests
 *
 * Tests all email Zod schemas with valid and invalid inputs.
 * Tests EmailConnectionSchema, CreateEmailConnectionOAuthSchema,
 * CreateEmailConnectionIMAPSchema, and EmailMessageSchema.
 */

import {
  EmailProviderEnum,
  EmailConnectionSchema,
  CreateEmailConnectionOAuthSchema,
  CreateEmailConnectionIMAPSchema,
  CreateEmailConnectionSchema,
  EmailMessageSchema,
  EmailMessagesListSchema,
  EmailSyncOptionsSchema,
  EmailSyncResultSchema,
} from '@/schemas/email';

describe('Email Schemas', () => {
  // ============================================================================
  // EmailProviderEnum Tests
  // ============================================================================

  describe('EmailProviderEnum', () => {
    it('should accept valid providers', () => {
      expect(EmailProviderEnum.safeParse('gmail').success).toBe(true);
      expect(EmailProviderEnum.safeParse('outlook').success).toBe(true);
      expect(EmailProviderEnum.safeParse('imap').success).toBe(true);
    });

    it('should reject invalid providers', () => {
      expect(EmailProviderEnum.safeParse('yahoo').success).toBe(false);
      expect(EmailProviderEnum.safeParse('google').success).toBe(false);
      expect(EmailProviderEnum.safeParse('').success).toBe(false);
      expect(EmailProviderEnum.safeParse(null).success).toBe(false);
    });
  });

  // ============================================================================
  // EmailConnectionSchema Tests
  // ============================================================================

  describe('EmailConnectionSchema', () => {
    const validConnection = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      user_id: '123e4567-e89b-12d3-a456-426614174001',
      provider: 'gmail',
      email_address: 'test@example.com',
      is_active: true,
      last_sync_at: '2024-03-01T10:00:00.000Z',
      sync_error: null,
      created_at: '2024-03-01T00:00:00.000Z',
      updated_at: '2024-03-01T00:00:00.000Z',
    };

    it('should accept valid connection data', () => {
      const result = EmailConnectionSchema.safeParse(validConnection);
      expect(result.success).toBe(true);
    });

    it('should require valid UUID for id', () => {
      const result = EmailConnectionSchema.safeParse({ ...validConnection, id: 'invalid' });
      expect(result.success).toBe(false);
    });

    it('should require valid UUID for user_id', () => {
      const result = EmailConnectionSchema.safeParse({ ...validConnection, user_id: 'invalid' });
      expect(result.success).toBe(false);
    });

    it('should reject invalid provider', () => {
      const result = EmailConnectionSchema.safeParse({ ...validConnection, provider: 'yahoo' });
      expect(result.success).toBe(false);
    });

    it('should require valid email address', () => {
      const result = EmailConnectionSchema.safeParse({
        ...validConnection,
        email_address: 'invalid-email',
      });
      expect(result.success).toBe(false);
    });

    it('should allow null last_sync_at', () => {
      const result = EmailConnectionSchema.safeParse({ ...validConnection, last_sync_at: null });
      expect(result.success).toBe(true);
    });

    it('should allow null sync_error', () => {
      const result = EmailConnectionSchema.safeParse({ ...validConnection, sync_error: null });
      expect(result.success).toBe(true);
    });

    it('should allow string sync_error', () => {
      const result = EmailConnectionSchema.safeParse({
        ...validConnection,
        sync_error: 'Token expired',
      });
      expect(result.success).toBe(true);
    });

    it('should require valid datetime for created_at', () => {
      const result = EmailConnectionSchema.safeParse({
        ...validConnection,
        created_at: 'invalid-date',
      });
      expect(result.success).toBe(false);
    });

    it('should reject missing required fields', () => {
      const { id, ...withoutId } = validConnection;
      expect(EmailConnectionSchema.safeParse(withoutId).success).toBe(false);

      const { user_id, ...withoutUserId } = validConnection;
      expect(EmailConnectionSchema.safeParse(withoutUserId).success).toBe(false);

      const { provider, ...withoutProvider } = validConnection;
      expect(EmailConnectionSchema.safeParse(withoutProvider).success).toBe(false);

      const { email_address, ...withoutEmail } = validConnection;
      expect(EmailConnectionSchema.safeParse(withoutEmail).success).toBe(false);
    });

    it('should accept all valid provider types', () => {
      expect(
        EmailConnectionSchema.safeParse({ ...validConnection, provider: 'gmail' }).success
      ).toBe(true);
      expect(
        EmailConnectionSchema.safeParse({ ...validConnection, provider: 'outlook' }).success
      ).toBe(true);
      expect(
        EmailConnectionSchema.safeParse({ ...validConnection, provider: 'imap' }).success
      ).toBe(true);
    });
  });

  // ============================================================================
  // CreateEmailConnectionOAuthSchema Tests
  // ============================================================================

  describe('CreateEmailConnectionOAuthSchema', () => {
    const validOAuth = {
      provider: 'gmail',
      access_token: 'ya29.a0AfH6SMBx...',
      refresh_token: '1//04dC...',
      expires_in: 3600,
      email_address: 'test@gmail.com',
    };

    it('should accept valid OAuth connection data', () => {
      const result = CreateEmailConnectionOAuthSchema.safeParse(validOAuth);
      expect(result.success).toBe(true);
    });

    it('should accept gmail provider', () => {
      const result = CreateEmailConnectionOAuthSchema.safeParse({
        ...validOAuth,
        provider: 'gmail',
      });
      expect(result.success).toBe(true);
    });

    it('should accept outlook provider', () => {
      const result = CreateEmailConnectionOAuthSchema.safeParse({
        ...validOAuth,
        provider: 'outlook',
      });
      expect(result.success).toBe(true);
    });

    it('should reject imap provider (OAuth only)', () => {
      const result = CreateEmailConnectionOAuthSchema.safeParse({
        ...validOAuth,
        provider: 'imap',
      });
      expect(result.success).toBe(false);
    });

    it('should reject empty access_token', () => {
      const result = CreateEmailConnectionOAuthSchema.safeParse({
        ...validOAuth,
        access_token: '',
      });
      expect(result.success).toBe(false);
    });

    it('should reject empty refresh_token', () => {
      const result = CreateEmailConnectionOAuthSchema.safeParse({
        ...validOAuth,
        refresh_token: '',
      });
      expect(result.success).toBe(false);
    });

    it('should reject missing tokens', () => {
      const { access_token, ...withoutAccess } = validOAuth;
      expect(CreateEmailConnectionOAuthSchema.safeParse(withoutAccess).success).toBe(false);

      const { refresh_token, ...withoutRefresh } = validOAuth;
      expect(CreateEmailConnectionOAuthSchema.safeParse(withoutRefresh).success).toBe(false);
    });

    it('should reject invalid email', () => {
      const result = CreateEmailConnectionOAuthSchema.safeParse({
        ...validOAuth,
        email_address: 'not-an-email',
      });
      expect(result.success).toBe(false);
    });

    it('should require positive expires_in', () => {
      expect(
        CreateEmailConnectionOAuthSchema.safeParse({ ...validOAuth, expires_in: 0 }).success
      ).toBe(false);
      expect(
        CreateEmailConnectionOAuthSchema.safeParse({ ...validOAuth, expires_in: -1 }).success
      ).toBe(false);
      expect(
        CreateEmailConnectionOAuthSchema.safeParse({ ...validOAuth, expires_in: 1 }).success
      ).toBe(true);
    });

    it('should reject non-integer expires_in', () => {
      const result = CreateEmailConnectionOAuthSchema.safeParse({
        ...validOAuth,
        expires_in: 3600.5,
      });
      expect(result.success).toBe(false);
    });
  });

  // ============================================================================
  // CreateEmailConnectionIMAPSchema Tests
  // ============================================================================

  describe('CreateEmailConnectionIMAPSchema', () => {
    const validIMAP = {
      provider: 'imap' as const,
      imap_server: 'imap.example.com',
      imap_port: 993,
      imap_username: 'user@example.com',
      imap_password: 'secret-password',
      email_address: 'user@example.com',
    };

    it('should accept valid IMAP connection data', () => {
      const result = CreateEmailConnectionIMAPSchema.safeParse(validIMAP);
      expect(result.success).toBe(true);
    });

    it('should only accept imap provider', () => {
      expect(
        CreateEmailConnectionIMAPSchema.safeParse({ ...validIMAP, provider: 'imap' }).success
      ).toBe(true);
      expect(
        CreateEmailConnectionIMAPSchema.safeParse({ ...validIMAP, provider: 'gmail' }).success
      ).toBe(false);
      expect(
        CreateEmailConnectionIMAPSchema.safeParse({ ...validIMAP, provider: 'outlook' }).success
      ).toBe(false);
    });

    it('should reject empty imap_server', () => {
      const result = CreateEmailConnectionIMAPSchema.safeParse({
        ...validIMAP,
        imap_server: '',
      });
      expect(result.success).toBe(false);
    });

    it('should validate port range (1-65535)', () => {
      // Below range
      expect(
        CreateEmailConnectionIMAPSchema.safeParse({ ...validIMAP, imap_port: 0 }).success
      ).toBe(false);
      expect(
        CreateEmailConnectionIMAPSchema.safeParse({ ...validIMAP, imap_port: -1 }).success
      ).toBe(false);

      // Above range
      expect(
        CreateEmailConnectionIMAPSchema.safeParse({ ...validIMAP, imap_port: 65536 }).success
      ).toBe(false);
      expect(
        CreateEmailConnectionIMAPSchema.safeParse({ ...validIMAP, imap_port: 100000 }).success
      ).toBe(false);

      // Valid ports
      expect(
        CreateEmailConnectionIMAPSchema.safeParse({ ...validIMAP, imap_port: 1 }).success
      ).toBe(true);
      expect(
        CreateEmailConnectionIMAPSchema.safeParse({ ...validIMAP, imap_port: 143 }).success
      ).toBe(true);
      expect(
        CreateEmailConnectionIMAPSchema.safeParse({ ...validIMAP, imap_port: 993 }).success
      ).toBe(true);
      expect(
        CreateEmailConnectionIMAPSchema.safeParse({ ...validIMAP, imap_port: 65535 }).success
      ).toBe(true);
    });

    it('should reject non-integer port', () => {
      const result = CreateEmailConnectionIMAPSchema.safeParse({
        ...validIMAP,
        imap_port: 993.5,
      });
      expect(result.success).toBe(false);
    });

    it('should reject empty imap_username', () => {
      const result = CreateEmailConnectionIMAPSchema.safeParse({
        ...validIMAP,
        imap_username: '',
      });
      expect(result.success).toBe(false);
    });

    it('should reject empty imap_password', () => {
      const result = CreateEmailConnectionIMAPSchema.safeParse({
        ...validIMAP,
        imap_password: '',
      });
      expect(result.success).toBe(false);
    });

    it('should reject invalid email address', () => {
      const result = CreateEmailConnectionIMAPSchema.safeParse({
        ...validIMAP,
        email_address: 'not-valid-email',
      });
      expect(result.success).toBe(false);
    });

    it('should reject missing required fields', () => {
      const { imap_server, ...withoutServer } = validIMAP;
      expect(CreateEmailConnectionIMAPSchema.safeParse(withoutServer).success).toBe(false);

      const { imap_port, ...withoutPort } = validIMAP;
      expect(CreateEmailConnectionIMAPSchema.safeParse(withoutPort).success).toBe(false);

      const { imap_username, ...withoutUsername } = validIMAP;
      expect(CreateEmailConnectionIMAPSchema.safeParse(withoutUsername).success).toBe(false);

      const { imap_password, ...withoutPassword } = validIMAP;
      expect(CreateEmailConnectionIMAPSchema.safeParse(withoutPassword).success).toBe(false);
    });
  });

  // ============================================================================
  // CreateEmailConnectionSchema (Discriminated Union) Tests
  // ============================================================================

  describe('CreateEmailConnectionSchema', () => {
    it('should accept valid Gmail OAuth connection', () => {
      const result = CreateEmailConnectionSchema.safeParse({
        provider: 'gmail',
        access_token: 'token',
        refresh_token: 'refresh',
        expires_in: 3600,
        email_address: 'test@gmail.com',
      });
      expect(result.success).toBe(true);
    });

    it('should accept valid Outlook OAuth connection', () => {
      const result = CreateEmailConnectionSchema.safeParse({
        provider: 'outlook',
        access_token: 'token',
        refresh_token: 'refresh',
        expires_in: 3600,
        email_address: 'test@outlook.com',
      });
      expect(result.success).toBe(true);
    });

    it('should accept valid IMAP connection', () => {
      const result = CreateEmailConnectionSchema.safeParse({
        provider: 'imap',
        imap_server: 'imap.example.com',
        imap_port: 993,
        imap_username: 'user',
        imap_password: 'pass',
        email_address: 'user@example.com',
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid provider', () => {
      const result = CreateEmailConnectionSchema.safeParse({
        provider: 'yahoo',
        access_token: 'token',
        refresh_token: 'refresh',
        expires_in: 3600,
        email_address: 'test@yahoo.com',
      });
      expect(result.success).toBe(false);
    });
  });

  // ============================================================================
  // EmailMessageSchema Tests
  // ============================================================================

  describe('EmailMessageSchema', () => {
    const validMessage = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      connection_id: '123e4567-e89b-12d3-a456-426614174001',
      provider_id: 'msg-12345',
      subject: 'Test Email Subject',
      sender: 'sender@example.com',
      sender_name: 'John Doe',
      received_at: '2024-03-01T10:00:00.000Z',
      snippet: 'This is the beginning of the email...',
      is_read: false,
      is_starred: false,
      labels: ['INBOX', 'IMPORTANT'],
      ai_summary: null,
    };

    it('should accept valid message data', () => {
      const result = EmailMessageSchema.safeParse(validMessage);
      expect(result.success).toBe(true);
    });

    it('should require valid UUID for id', () => {
      const result = EmailMessageSchema.safeParse({ ...validMessage, id: 'invalid' });
      expect(result.success).toBe(false);
    });

    it('should require valid UUID for connection_id', () => {
      const result = EmailMessageSchema.safeParse({ ...validMessage, connection_id: 'invalid' });
      expect(result.success).toBe(false);
    });

    it('should handle nullable subject', () => {
      const result = EmailMessageSchema.safeParse({ ...validMessage, subject: null });
      expect(result.success).toBe(true);
    });

    it('should handle nullable sender_name', () => {
      const result = EmailMessageSchema.safeParse({ ...validMessage, sender_name: null });
      expect(result.success).toBe(true);
    });

    it('should handle nullable snippet', () => {
      const result = EmailMessageSchema.safeParse({ ...validMessage, snippet: null });
      expect(result.success).toBe(true);
    });

    it('should handle nullable ai_summary', () => {
      const result = EmailMessageSchema.safeParse({ ...validMessage, ai_summary: null });
      expect(result.success).toBe(true);

      const withSummary = EmailMessageSchema.safeParse({
        ...validMessage,
        ai_summary: 'This email is about...',
      });
      expect(withSummary.success).toBe(true);
    });

    it('should require valid datetime for received_at', () => {
      const result = EmailMessageSchema.safeParse({
        ...validMessage,
        received_at: 'invalid-date',
      });
      expect(result.success).toBe(false);
    });

    it('should require boolean is_read', () => {
      expect(EmailMessageSchema.safeParse({ ...validMessage, is_read: true }).success).toBe(true);
      expect(EmailMessageSchema.safeParse({ ...validMessage, is_read: false }).success).toBe(true);
      expect(EmailMessageSchema.safeParse({ ...validMessage, is_read: 'yes' }).success).toBe(false);
    });

    it('should require boolean is_starred', () => {
      expect(EmailMessageSchema.safeParse({ ...validMessage, is_starred: true }).success).toBe(
        true
      );
      expect(EmailMessageSchema.safeParse({ ...validMessage, is_starred: false }).success).toBe(
        true
      );
      expect(EmailMessageSchema.safeParse({ ...validMessage, is_starred: 1 }).success).toBe(false);
    });

    it('should accept array of labels', () => {
      expect(EmailMessageSchema.safeParse({ ...validMessage, labels: [] }).success).toBe(true);
      expect(EmailMessageSchema.safeParse({ ...validMessage, labels: ['INBOX'] }).success).toBe(
        true
      );
      expect(
        EmailMessageSchema.safeParse({
          ...validMessage,
          labels: ['INBOX', 'IMPORTANT', 'STARRED'],
        }).success
      ).toBe(true);
    });

    it('should reject non-string items in labels array', () => {
      const result = EmailMessageSchema.safeParse({ ...validMessage, labels: [1, 2, 3] });
      expect(result.success).toBe(false);
    });

    it('should require provider_id', () => {
      const { provider_id, ...withoutProviderId } = validMessage;
      expect(EmailMessageSchema.safeParse(withoutProviderId).success).toBe(false);
    });

    it('should require sender', () => {
      const { sender, ...withoutSender } = validMessage;
      expect(EmailMessageSchema.safeParse(withoutSender).success).toBe(false);
    });
  });

  // ============================================================================
  // EmailMessagesListSchema Tests
  // ============================================================================

  describe('EmailMessagesListSchema', () => {
    const validMessage = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      connection_id: '123e4567-e89b-12d3-a456-426614174001',
      provider_id: 'msg-12345',
      subject: 'Test',
      sender: 'test@example.com',
      sender_name: null,
      received_at: '2024-03-01T10:00:00.000Z',
      snippet: null,
      is_read: false,
      is_starred: false,
      labels: [],
      ai_summary: null,
    };

    it('should accept valid messages list', () => {
      const result = EmailMessagesListSchema.safeParse({
        messages: [validMessage],
        has_more: true,
        next_page_token: 'token123',
        total_count: 100,
      });
      expect(result.success).toBe(true);
    });

    it('should accept empty messages array', () => {
      const result = EmailMessagesListSchema.safeParse({
        messages: [],
        has_more: false,
      });
      expect(result.success).toBe(true);
    });

    it('should allow optional next_page_token', () => {
      const result = EmailMessagesListSchema.safeParse({
        messages: [],
        has_more: false,
      });
      expect(result.success).toBe(true);
    });

    it('should allow optional total_count', () => {
      const result = EmailMessagesListSchema.safeParse({
        messages: [],
        has_more: false,
        total_count: 50,
      });
      expect(result.success).toBe(true);
    });

    it('should reject negative total_count', () => {
      const result = EmailMessagesListSchema.safeParse({
        messages: [],
        has_more: false,
        total_count: -1,
      });
      expect(result.success).toBe(false);
    });
  });

  // ============================================================================
  // EmailSyncOptionsSchema Tests
  // ============================================================================

  describe('EmailSyncOptionsSchema', () => {
    it('should accept valid sync options', () => {
      const result = EmailSyncOptionsSchema.safeParse({
        max_results: 50,
        since: '2024-03-01T00:00:00.000Z',
        label_ids: ['INBOX'],
      });
      expect(result.success).toBe(true);
    });

    it('should apply default max_results', () => {
      const result = EmailSyncOptionsSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.max_results).toBe(50);
      }
    });

    it('should reject max_results > 100', () => {
      const result = EmailSyncOptionsSchema.safeParse({ max_results: 101 });
      expect(result.success).toBe(false);
    });

    it('should reject max_results <= 0', () => {
      expect(EmailSyncOptionsSchema.safeParse({ max_results: 0 }).success).toBe(false);
      expect(EmailSyncOptionsSchema.safeParse({ max_results: -1 }).success).toBe(false);
    });

    it('should validate since as datetime', () => {
      const result = EmailSyncOptionsSchema.safeParse({ since: 'invalid-date' });
      expect(result.success).toBe(false);
    });
  });

  // ============================================================================
  // EmailSyncResultSchema Tests
  // ============================================================================

  describe('EmailSyncResultSchema', () => {
    it('should accept successful sync result', () => {
      const result = EmailSyncResultSchema.safeParse({
        success: true,
        message_count: 25,
        synced_at: '2024-03-01T10:00:00.000Z',
      });
      expect(result.success).toBe(true);
    });

    it('should accept failed sync result with error', () => {
      const result = EmailSyncResultSchema.safeParse({
        success: false,
        message_count: 0,
        error: 'Token expired',
        synced_at: '2024-03-01T10:00:00.000Z',
      });
      expect(result.success).toBe(true);
    });

    it('should reject negative message_count', () => {
      const result = EmailSyncResultSchema.safeParse({
        success: true,
        message_count: -1,
        synced_at: '2024-03-01T10:00:00.000Z',
      });
      expect(result.success).toBe(false);
    });

    it('should allow zero message_count', () => {
      const result = EmailSyncResultSchema.safeParse({
        success: true,
        message_count: 0,
        synced_at: '2024-03-01T10:00:00.000Z',
      });
      expect(result.success).toBe(true);
    });

    it('should validate synced_at as datetime', () => {
      const result = EmailSyncResultSchema.safeParse({
        success: true,
        message_count: 0,
        synced_at: 'invalid',
      });
      expect(result.success).toBe(false);
    });
  });
});
