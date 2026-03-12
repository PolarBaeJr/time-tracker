/**
 * EmailWidget Component
 *
 * Hub widget displaying recent emails with unread count,
 * email previews, and AI-generated summaries for larger sizes.
 *
 * Size-based layouts:
 * - Small: Unread count only
 * - Medium: Unread count + 2-3 email previews
 * - Large: Unread count + 5 email previews + AI summary
 */

import * as React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';

import { WidgetCard } from '../WidgetCard';
import { Text, Button, Icon } from '@/components/ui';
import { useTheme, spacing } from '@/theme';
import { useRecentEmails, useEmailConnections } from '@/hooks';
import type { WidgetSize } from '../WidgetRegistry';
import type { MainTabParamList } from '@/navigation/types';
import type { EmailMessage } from '@/schemas';

/**
 * EmailWidget component props
 */
export interface EmailWidgetProps {
  /** Widget size affects layout and information density */
  size: WidgetSize;
}

type TabNav = BottomTabNavigationProp<MainTabParamList>;

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
 * Unread dot indicator
 */
function UnreadDot({ color }: { color: string }): React.ReactElement {
  return <View style={[styles.unreadDot, { backgroundColor: color }]} />;
}

/**
 * Email preview item component
 */
interface EmailPreviewProps {
  email: EmailMessage;
  onPress: () => void;
  compact?: boolean;
}

function EmailPreview({ email, onPress, compact = false }: EmailPreviewProps): React.ReactElement {
  const { colors } = useTheme();

  const senderName = getSenderDisplayName(email);
  const subject = email.subject || '(No subject)';
  const timeAgo = formatRelativeTime(email.received_at);

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.emailPreview,
        { borderBottomColor: colors.border },
        compact && styles.emailPreviewCompact,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`Email from ${senderName}: ${subject}`}
    >
      <View style={styles.emailPreviewContent}>
        <View style={styles.emailPreviewHeader}>
          <View style={styles.emailPreviewSenderRow}>
            {!email.is_read && <UnreadDot color={colors.primary} />}
            <Text
              variant={email.is_read ? 'bodySmall' : 'label'}
              numberOfLines={1}
              style={[styles.senderName, !email.is_read && { color: colors.text }]}
            >
              {truncateText(senderName, compact ? 15 : 20)}
            </Text>
          </View>
          <Text variant="caption" color="muted" style={styles.timeAgo}>
            {timeAgo}
          </Text>
        </View>
        <Text
          variant="bodySmall"
          numberOfLines={1}
          color={email.is_read ? 'secondary' : 'primary'}
          style={styles.subject}
        >
          {truncateText(subject, compact ? 25 : 35)}
        </Text>
      </View>
    </Pressable>
  );
}

/**
 * Not connected state component
 */
function NotConnectedState({ onConnect }: { onConnect: () => void }): React.ReactElement {
  const { colors } = useTheme();

  return (
    <View style={styles.emptyState}>
      <Icon name="mail-outline" size={32} color={colors.textMuted} />
      <Text variant="bodySmall" color="secondary" style={styles.emptyText}>
        Connect an email account
      </Text>
      <Button variant="outline" size="sm" onPress={onConnect} style={styles.connectButton}>
        <Text variant="label">Connect</Text>
      </Button>
    </View>
  );
}

/**
 * Empty state component (connected but no emails)
 */
function EmptyState(): React.ReactElement {
  const { colors } = useTheme();

  return (
    <View style={styles.emptyState}>
      <Icon name="mail-open-outline" size={32} color={colors.textMuted} />
      <Text variant="bodySmall" color="secondary" style={styles.emptyText}>
        No recent emails
      </Text>
    </View>
  );
}

/**
 * EmailWidget Component
 *
 * Displays recent emails with size-based layouts:
 * - Small: Unread count badge only
 * - Medium: Unread count + 2-3 email previews
 * - Large: Unread count + 5 email previews + AI summary
 */
export function EmailWidget({ size }: EmailWidgetProps): React.ReactElement {
  const { colors } = useTheme();
  const navigation = useNavigation<TabNav>();

  // Fetch email connections and recent emails
  const { hasConnections, isLoading: connectionsLoading } = useEmailConnections();
  const { data: emails, isLoading: emailsLoading, error } = useRecentEmails();

  const isLoading = connectionsLoading || emailsLoading;

  // Calculate unread count
  const unreadCount = React.useMemo(() => {
    if (!emails) return 0;
    return emails.filter(email => !email.is_read).length;
  }, [emails]);

  // Get email previews based on size
  const previewEmails = React.useMemo(() => {
    if (!emails) return [];
    const limit = size === 'large' ? 5 : size === 'medium' ? 3 : 0;
    return emails.slice(0, limit);
  }, [emails, size]);

  // Get AI summary from the most recent email (if available)
  const aiSummary = React.useMemo(() => {
    if (size !== 'large' || !emails || emails.length === 0) return null;
    // Find the first email with an AI summary
    const emailWithSummary = emails.find(email => email.ai_summary);
    return emailWithSummary?.ai_summary ?? null;
  }, [emails, size]);

  const handleNavigateToEmail = React.useCallback(() => {
    // Navigate to email/inbox section
    navigation.navigate('Settings', { screen: 'EmailSettings' } as never);
  }, [navigation]);

  const handleEmailPress = React.useCallback(
    (_email: EmailMessage) => {
      // For now, navigate to email settings. In the future, could open email detail view
      handleNavigateToEmail();
    },
    [handleNavigateToEmail]
  );

  // Render compact view for small size
  if (size === 'small') {
    // Not connected state
    if (!hasConnections && !connectionsLoading) {
      return (
        <WidgetCard
          title="Email"
          icon="mail"
          size={size}
          loading={isLoading}
          error={error ?? null}
          onExpand={handleNavigateToEmail}
        >
          <Pressable
            onPress={handleNavigateToEmail}
            style={styles.compactContainer}
            accessibilityRole="button"
            accessibilityLabel="Connect email account"
          >
            <Icon name="mail-outline" size={24} color={colors.textMuted} />
          </Pressable>
        </WidgetCard>
      );
    }

    return (
      <WidgetCard
        title="Email"
        icon="mail"
        size={size}
        loading={isLoading}
        error={error ?? null}
        onExpand={handleNavigateToEmail}
      >
        <Pressable
          onPress={handleNavigateToEmail}
          style={styles.compactContainer}
          accessibilityRole="button"
          accessibilityLabel={`${unreadCount} unread emails`}
        >
          <View style={styles.compactRow}>
            {unreadCount > 0 && (
              <View style={[styles.unreadBadge, { backgroundColor: colors.primary }]}>
                <Text variant="caption" style={styles.unreadBadgeText}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </Text>
              </View>
            )}
            {unreadCount === 0 && <Icon name="checkmark-circle" size={20} color={colors.success} />}
          </View>
        </Pressable>
      </WidgetCard>
    );
  }

  // Render full view for medium/large size
  return (
    <WidgetCard
      title="Email"
      icon="mail"
      size={size}
      loading={isLoading}
      error={error ?? null}
      onExpand={handleNavigateToEmail}
    >
      <View style={styles.fullContainer}>
        {/* Not connected state */}
        {!hasConnections && !connectionsLoading && (
          <NotConnectedState onConnect={handleNavigateToEmail} />
        )}

        {/* Connected but no emails */}
        {hasConnections && (!emails || emails.length === 0) && !emailsLoading && <EmptyState />}

        {/* Has emails */}
        {hasConnections && emails && emails.length > 0 && (
          <>
            {/* Unread count header */}
            <View style={styles.headerSection}>
              <View style={styles.unreadSection}>
                {unreadCount > 0 ? (
                  <>
                    <View style={[styles.unreadBadgeLarge, { backgroundColor: colors.primary }]}>
                      <Text variant="label" style={styles.unreadBadgeText}>
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </Text>
                    </View>
                    <Text variant="bodySmall" color="secondary" style={styles.unreadLabel}>
                      unread
                    </Text>
                  </>
                ) : (
                  <>
                    <Icon name="checkmark-circle" size={20} color={colors.success} />
                    <Text variant="bodySmall" color="secondary" style={styles.unreadLabel}>
                      All caught up
                    </Text>
                  </>
                )}
              </View>
            </View>

            {/* Email previews */}
            <View style={styles.emailList}>
              {previewEmails.map(email => (
                <EmailPreview
                  key={email.id}
                  email={email}
                  onPress={() => handleEmailPress(email)}
                  compact={size === 'medium'}
                />
              ))}
            </View>

            {/* AI Summary (large size only) */}
            {size === 'large' && aiSummary && (
              <View style={[styles.aiSummarySection, { backgroundColor: `${colors.primary}10` }]}>
                <View style={styles.aiSummaryHeader}>
                  <Icon name="sparkles" size={14} color={colors.primary} />
                  <Text variant="caption" style={{ color: colors.primary, marginLeft: spacing.xs }}>
                    AI Summary
                  </Text>
                </View>
                <Text variant="bodySmall" color="secondary" numberOfLines={3}>
                  {aiSummary}
                </Text>
              </View>
            )}
          </>
        )}
      </View>
    </WidgetCard>
  );
}

const styles = StyleSheet.create({
  compactContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
  },
  compactRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  fullContainer: {
    minHeight: 80,
  },
  headerSection: {
    marginBottom: spacing.sm,
  },
  unreadSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  unreadBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 20,
    alignItems: 'center',
  },
  unreadBadgeLarge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    minWidth: 24,
    alignItems: 'center',
  },
  unreadBadgeText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 12,
  },
  unreadLabel: {
    marginLeft: spacing.xs,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: spacing.xs,
  },
  emailList: {
    marginTop: spacing.xs,
  },
  emailPreview: {
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  emailPreviewCompact: {
    paddingVertical: spacing.xs,
  },
  emailPreviewContent: {
    flex: 1,
  },
  emailPreviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  emailPreviewSenderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  senderName: {
    flex: 1,
  },
  timeAgo: {
    marginLeft: spacing.sm,
  },
  subject: {
    marginTop: 2,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
  },
  emptyText: {
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  connectButton: {
    marginTop: spacing.md,
  },
  aiSummarySection: {
    marginTop: spacing.md,
    padding: spacing.sm,
    borderRadius: 8,
  },
  aiSummaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
});

export default EmailWidget;
