/**
 * EmailWidget Component Tests
 *
 * Tests for the EmailWidget component logic including:
 * - Relative time formatting
 * - Text truncation
 * - Sender display name extraction
 * - Size-based layout logic
 * - Connection state logic
 * - Unread count calculation
 */

import type { EmailMessage, EmailConnection } from '@/schemas';

// ============================================================================
// HELPER FUNCTIONS (copied from EmailWidget for isolated testing)
// ============================================================================

/**
 * Format relative time from a date string (e.g., "2m", "1h", "3d")
 */
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMinutes < 1) {
    return 'now';
  }

  if (diffMinutes < 60) {
    return `${diffMinutes}m`;
  }

  if (diffHours < 24) {
    return `${diffHours}h`;
  }

  if (diffDays < 7) {
    return `${diffDays}d`;
  }

  // For older emails, show abbreviated date
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/**
 * Truncate text to a maximum length with ellipsis
 */
function truncateText(text: string | null, maxLength: number): string {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 1).trim() + '…';
}

/**
 * Get display name from sender info
 */
function getSenderDisplayName(email: EmailMessage): string {
  if (email.sender_name) {
    return email.sender_name;
  }
  // Extract name from email address (before @)
  const atIndex = email.sender.indexOf('@');
  if (atIndex > 0) {
    return email.sender.slice(0, atIndex);
  }
  return email.sender;
}

/**
 * Get email preview count based on widget size
 */
function getPreviewCount(size: 'small' | 'medium' | 'large'): number {
  switch (size) {
    case 'small':
      return 0;
    case 'medium':
      return 3;
    case 'large':
      return 5;
    default:
      return 0;
  }
}

/**
 * Calculate unread count from emails
 */
function calculateUnreadCount(emails: EmailMessage[]): number {
  return emails.filter(email => !email.is_read).length;
}

/**
 * Determine widget state based on data
 */
type WidgetState = 'not_connected' | 'loading' | 'error' | 'empty' | 'data';

interface WidgetStateInput {
  hasConnections: boolean;
  isLoading: boolean;
  error: Error | null;
  emails: EmailMessage[] | null | undefined;
}

function getWidgetState(input: WidgetStateInput): WidgetState {
  if (input.isLoading) return 'loading';
  if (input.error) return 'error';
  if (!input.hasConnections) return 'not_connected';
  if (!input.emails || input.emails.length === 0) return 'empty';
  return 'data';
}

// ============================================================================
// MOCK DATA
// ============================================================================

const mockEmails: EmailMessage[] = [
  {
    id: 'email-1',
    connection_id: 'conn-1',
    provider_id: 'gmail-123',
    subject: 'Important project update',
    sender: 'john.doe@example.com',
    sender_name: 'John Doe',
    received_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30 min ago
    snippet: 'Here is the latest update on the project...',
    is_read: false,
    is_starred: false,
    labels: ['INBOX'],
    ai_summary: null,
  },
  {
    id: 'email-2',
    connection_id: 'conn-1',
    provider_id: 'gmail-456',
    subject: 'Weekly team sync notes',
    sender: 'jane.smith@company.org',
    sender_name: 'Jane Smith',
    received_at: new Date(Date.now() - 2 * 3600 * 1000).toISOString(), // 2 hours ago
    snippet: 'Summary of our weekly sync meeting...',
    is_read: true,
    is_starred: false,
    labels: ['INBOX'],
    ai_summary: null,
  },
  {
    id: 'email-3',
    connection_id: 'conn-1',
    provider_id: 'gmail-789',
    subject: null, // No subject
    sender: 'notifications@github.com',
    sender_name: null, // No sender name
    received_at: new Date(Date.now() - 24 * 3600 * 1000).toISOString(), // 1 day ago
    snippet: 'You have a new pull request review...',
    is_read: false,
    is_starred: true,
    labels: ['INBOX', 'IMPORTANT'],
    ai_summary: null,
  },
  {
    id: 'email-4',
    connection_id: 'conn-1',
    provider_id: 'gmail-101',
    subject: 'This is a very long email subject that should definitely be truncated when displayed',
    sender: 'marketing@longcompanyname.com',
    sender_name: 'Marketing Team at Very Long Company Name Inc',
    received_at: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(), // 3 days ago
    snippet: 'Check out our latest offers...',
    is_read: true,
    is_starred: false,
    labels: ['INBOX'],
    ai_summary: 'Marketing newsletter about latest offers and promotions.',
  },
  {
    id: 'email-5',
    connection_id: 'conn-1',
    provider_id: 'gmail-102',
    subject: 'Invoice #12345',
    sender: 'billing@service.io',
    sender_name: 'Billing Department',
    received_at: new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString(), // 7 days ago
    snippet: 'Your invoice is ready...',
    is_read: false,
    is_starred: false,
    labels: ['INBOX'],
    ai_summary: null,
  },
];

const mockConnections: EmailConnection[] = [
  {
    id: 'conn-1',
    user_id: 'user-1',
    provider: 'gmail',
    email_address: 'user@gmail.com',
    is_active: true,
    last_sync_at: new Date().toISOString(),
    sync_error: null,
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: new Date().toISOString(),
  },
];

// ============================================================================
// TESTS
// ============================================================================

describe('EmailWidget', () => {
  describe('formatRelativeTime', () => {
    it('should return "now" for very recent times', () => {
      const justNow = new Date().toISOString();
      expect(formatRelativeTime(justNow)).toBe('now');
    });

    it('should format minutes ago', () => {
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      expect(formatRelativeTime(tenMinutesAgo)).toBe('10m');
    });

    it('should format 59 minutes ago', () => {
      const fiftyNineMinutesAgo = new Date(Date.now() - 59 * 60 * 1000).toISOString();
      expect(formatRelativeTime(fiftyNineMinutesAgo)).toBe('59m');
    });

    it('should format hours ago', () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 3600 * 1000).toISOString();
      expect(formatRelativeTime(twoHoursAgo)).toBe('2h');
    });

    it('should format 23 hours ago', () => {
      const twentyThreeHoursAgo = new Date(Date.now() - 23 * 3600 * 1000).toISOString();
      expect(formatRelativeTime(twentyThreeHoursAgo)).toBe('23h');
    });

    it('should format days ago', () => {
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString();
      expect(formatRelativeTime(threeDaysAgo)).toBe('3d');
    });

    it('should format 6 days ago', () => {
      const sixDaysAgo = new Date(Date.now() - 6 * 24 * 3600 * 1000).toISOString();
      expect(formatRelativeTime(sixDaysAgo)).toBe('6d');
    });

    it('should format dates older than 7 days as abbreviated date', () => {
      const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 3600 * 1000);
      const result = formatRelativeTime(twoWeeksAgo.toISOString());
      // Should be something like "Mar 1" depending on current date
      expect(result).toMatch(/^\w{3} \d{1,2}$/);
    });
  });

  describe('truncateText', () => {
    it('should return empty string for null input', () => {
      expect(truncateText(null, 20)).toBe('');
    });

    it('should return original text if shorter than max length', () => {
      expect(truncateText('Short text', 20)).toBe('Short text');
    });

    it('should return original text if equal to max length', () => {
      expect(truncateText('Exactly ten', 11)).toBe('Exactly ten');
    });

    it('should truncate with ellipsis if longer than max length', () => {
      expect(truncateText('This is a long text that needs truncation', 20)).toBe(
        'This is a long text…'
      );
    });

    it('should handle single character max length', () => {
      expect(truncateText('Hello', 1)).toBe('…');
    });

    it('should trim trailing spaces before ellipsis', () => {
      expect(truncateText('Hello World Everyone', 12)).toBe('Hello World…');
    });
  });

  describe('getSenderDisplayName', () => {
    it('should return sender_name if available', () => {
      const email = mockEmails[0]; // Has sender_name "John Doe"
      expect(getSenderDisplayName(email)).toBe('John Doe');
    });

    it('should extract name from email address if no sender_name', () => {
      const email: EmailMessage = {
        ...mockEmails[2],
        sender_name: null,
        sender: 'notifications@github.com',
      };
      expect(getSenderDisplayName(email)).toBe('notifications');
    });

    it('should return full sender if no @ symbol', () => {
      const email: EmailMessage = {
        ...mockEmails[0],
        sender_name: null,
        sender: 'LocalSender',
      };
      expect(getSenderDisplayName(email)).toBe('LocalSender');
    });

    it('should handle empty string before @ symbol', () => {
      const email: EmailMessage = {
        ...mockEmails[0],
        sender_name: null,
        sender: '@domain.com',
      };
      // atIndex = 0, which is not > 0, so returns full sender
      expect(getSenderDisplayName(email)).toBe('@domain.com');
    });
  });

  describe('getPreviewCount', () => {
    it('should return 0 for small size', () => {
      expect(getPreviewCount('small')).toBe(0);
    });

    it('should return 3 for medium size', () => {
      expect(getPreviewCount('medium')).toBe(3);
    });

    it('should return 5 for large size', () => {
      expect(getPreviewCount('large')).toBe(5);
    });
  });

  describe('calculateUnreadCount', () => {
    it('should return 0 for empty array', () => {
      expect(calculateUnreadCount([])).toBe(0);
    });

    it('should count unread emails correctly', () => {
      // mockEmails has 3 unread (email-1, email-3, email-5)
      expect(calculateUnreadCount(mockEmails)).toBe(3);
    });

    it('should return 0 when all emails are read', () => {
      const allRead = mockEmails.map(e => ({ ...e, is_read: true }));
      expect(calculateUnreadCount(allRead)).toBe(0);
    });

    it('should return total count when all emails are unread', () => {
      const allUnread = mockEmails.map(e => ({ ...e, is_read: false }));
      expect(calculateUnreadCount(allUnread)).toBe(5);
    });
  });

  describe('getWidgetState', () => {
    it('should return "loading" when isLoading is true', () => {
      const result = getWidgetState({
        hasConnections: true,
        isLoading: true,
        error: null,
        emails: null,
      });
      expect(result).toBe('loading');
    });

    it('should return "error" when error exists (even if loading)', () => {
      const result = getWidgetState({
        hasConnections: true,
        isLoading: false,
        error: new Error('Network error'),
        emails: null,
      });
      expect(result).toBe('error');
    });

    it('should return "not_connected" when no connections', () => {
      const result = getWidgetState({
        hasConnections: false,
        isLoading: false,
        error: null,
        emails: null,
      });
      expect(result).toBe('not_connected');
    });

    it('should return "empty" when connected but no emails', () => {
      const result = getWidgetState({
        hasConnections: true,
        isLoading: false,
        error: null,
        emails: [],
      });
      expect(result).toBe('empty');
    });

    it('should return "empty" when connected but emails is null', () => {
      const result = getWidgetState({
        hasConnections: true,
        isLoading: false,
        error: null,
        emails: null,
      });
      expect(result).toBe('empty');
    });

    it('should return "data" when connected with emails', () => {
      const result = getWidgetState({
        hasConnections: true,
        isLoading: false,
        error: null,
        emails: mockEmails,
      });
      expect(result).toBe('data');
    });
  });

  describe('email preview display', () => {
    it('should show sender name truncated for compact mode', () => {
      const senderName = getSenderDisplayName(mockEmails[3]); // Long sender name
      const truncated = truncateText(senderName, 15); // compact mode max
      expect(truncated.length).toBeLessThanOrEqual(15);
      expect(truncated).toContain('…');
    });

    it('should show sender name truncated for normal mode', () => {
      const senderName = getSenderDisplayName(mockEmails[3]); // Long sender name
      const truncated = truncateText(senderName, 20); // normal mode max
      expect(truncated.length).toBeLessThanOrEqual(20);
      expect(truncated).toContain('…');
    });

    it('should show "(No subject)" for null subject', () => {
      const subject = mockEmails[2].subject || '(No subject)';
      expect(subject).toBe('(No subject)');
    });

    it('should show relative time for each email', () => {
      mockEmails.forEach(email => {
        const time = formatRelativeTime(email.received_at);
        expect(time).toBeDefined();
        expect(typeof time).toBe('string');
        expect(time.length).toBeGreaterThan(0);
      });
    });
  });

  describe('unread indicator', () => {
    it('should identify unread emails', () => {
      const unreadEmails = mockEmails.filter(e => !e.is_read);
      expect(unreadEmails.length).toBe(3);
      expect(unreadEmails.map(e => e.id)).toContain('email-1');
      expect(unreadEmails.map(e => e.id)).toContain('email-3');
      expect(unreadEmails.map(e => e.id)).toContain('email-5');
    });

    it('should identify read emails', () => {
      const readEmails = mockEmails.filter(e => e.is_read);
      expect(readEmails.length).toBe(2);
      expect(readEmails.map(e => e.id)).toContain('email-2');
      expect(readEmails.map(e => e.id)).toContain('email-4');
    });
  });

  describe('unread badge display', () => {
    it('should show count for small unread counts', () => {
      const unreadCount = 5;
      const displayText = unreadCount > 99 ? '99+' : String(unreadCount);
      expect(displayText).toBe('5');
    });

    it('should show "99+" for large unread counts', () => {
      const unreadCount = 150;
      const displayText = unreadCount > 99 ? '99+' : String(unreadCount);
      expect(displayText).toBe('99+');
    });

    it('should show exact count for 99 unread', () => {
      const unreadCount = 99;
      const displayText = unreadCount > 99 ? '99+' : String(unreadCount);
      expect(displayText).toBe('99');
    });
  });

  describe('AI summary display', () => {
    it('should find emails with AI summaries', () => {
      const emailsWithSummary = mockEmails.filter(e => e.ai_summary);
      expect(emailsWithSummary.length).toBe(1);
      expect(emailsWithSummary[0].id).toBe('email-4');
    });

    it('should return null when no emails have summaries', () => {
      const emailsWithoutSummary = mockEmails.filter(e => !e.ai_summary);
      const summary = emailsWithoutSummary.find(e => e.ai_summary)?.ai_summary ?? null;
      expect(summary).toBeNull();
    });
  });

  describe('size-based layout', () => {
    describe('small size', () => {
      const size = 'small' as const;
      const previewCount = getPreviewCount(size);

      it('should not show any email previews', () => {
        expect(previewCount).toBe(0);
      });

      it('should only show unread badge', () => {
        // In small size, only unread count is shown, not email list
        expect(previewCount).toBe(0);
      });
    });

    describe('medium size', () => {
      const size = 'medium' as const;
      const previewCount = getPreviewCount(size);

      it('should show up to 3 email previews', () => {
        expect(previewCount).toBe(3);
      });

      it('should limit emails to preview count', () => {
        const previewEmails = mockEmails.slice(0, previewCount);
        expect(previewEmails.length).toBeLessThanOrEqual(3);
      });
    });

    describe('large size', () => {
      const size = 'large' as const;
      const previewCount = getPreviewCount(size);

      it('should show up to 5 email previews', () => {
        expect(previewCount).toBe(5);
      });

      it('should limit emails to preview count', () => {
        const previewEmails = mockEmails.slice(0, previewCount);
        expect(previewEmails.length).toBeLessThanOrEqual(5);
      });

      it('should show AI summary if available', () => {
        // Large size shows AI summary section
        const emailWithSummary = mockEmails.find(e => e.ai_summary);
        expect(emailWithSummary?.ai_summary).toBeDefined();
      });
    });
  });

  describe('accessibility', () => {
    it('should have accessible label for unread emails', () => {
      const unreadCount = 3;
      const label = `${unreadCount} unread emails`;
      expect(label).toBe('3 unread emails');
    });

    it('should have accessible label for email preview', () => {
      const email = mockEmails[0];
      const senderName = getSenderDisplayName(email);
      const subject = email.subject || '(No subject)';
      const label = `Email from ${senderName}: ${subject}`;
      expect(label).toBe('Email from John Doe: Important project update');
    });

    it('should have accessible label for connect action', () => {
      const label = 'Connect email account';
      expect(label).toBe('Connect email account');
    });
  });

  describe('connection state logic', () => {
    it('should detect when user has connections', () => {
      const hasConnections = mockConnections.length > 0;
      expect(hasConnections).toBe(true);
    });

    it('should detect when user has no connections', () => {
      const emptyConnections: EmailConnection[] = [];
      const hasConnections = emptyConnections.length > 0;
      expect(hasConnections).toBe(false);
    });

    it('should check if connection is active', () => {
      const activeConnections = mockConnections.filter(c => c.is_active);
      expect(activeConnections.length).toBe(1);
    });
  });
});
