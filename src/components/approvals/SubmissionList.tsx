/**
 * SubmissionList Component
 *
 * Displays the current user's submitted time entries and their approval status.
 * Entries are grouped by submission date.
 *
 * USAGE:
 * ```tsx
 * <SubmissionList
 *   workspaceId={workspaceId}
 *   onEntryPress={(entry) => showDetail(entry)}
 * />
 * ```
 *
 * SECURITY:
 * - RLS policies ensure users only see their own submissions
 */

import * as React from 'react';
import { useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  SectionList,
  RefreshControl,
  Pressable,
  type SectionListRenderItem,
} from 'react-native';
import { Text, Card, Icon, Spinner, ErrorState } from '@/components/ui';
import { ApprovalStatusBadge } from './ApprovalStatusBadge';
import { useMySubmissions } from '@/hooks';
import { useTheme } from '@/theme';
import { spacing, borderRadius } from '@/theme';
import type { TimeEntryWithApprovalAndUser, ApprovalStatus } from '@/schemas';

/**
 * Props for SubmissionList component
 */
export interface SubmissionListProps {
  /** Workspace ID to fetch submissions for */
  workspaceId: string;
  /** Filter by specific statuses (default: all non-draft) */
  statuses?: ApprovalStatus[];
  /** Callback when an entry is tapped */
  onEntryPress?: (entry: TimeEntryWithApprovalAndUser) => void;
}

/**
 * Section data for grouped submissions
 */
interface SubmissionSection {
  title: string;
  date: Date;
  data: TimeEntryWithApprovalAndUser[];
}

/**
 * Format duration in seconds to human-readable string
 */
function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

/**
 * Format date to section header
 */
function formatSectionDate(date: Date): string {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) {
    return 'Today';
  }
  if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  }

  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Format time from ISO string
 */
function formatTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

/**
 * Get date key for grouping
 */
function getDateKey(isoString: string): string {
  const date = new Date(isoString);
  return date.toISOString().split('T')[0];
}

/**
 * SubmissionList component
 */
export function SubmissionList({
  workspaceId,
  statuses,
  onEntryPress,
}: SubmissionListProps): React.ReactElement {
  const { colors } = useTheme();

  const {
    data: entries,
    isLoading,
    isRefetching,
    refetch,
    error,
  } = useMySubmissions(workspaceId, { statuses });

  /**
   * Group entries by submission date
   */
  const sections = useMemo<SubmissionSection[]>(() => {
    if (!entries || entries.length === 0) return [];

    const groups = new Map<string, TimeEntryWithApprovalAndUser[]>();

    for (const entry of entries) {
      const dateKey = getDateKey(entry.submitted_at || entry.start_at);
      const existing = groups.get(dateKey);
      if (existing) {
        existing.push(entry);
      } else {
        groups.set(dateKey, [entry]);
      }
    }

    // Sort by date descending and convert to sections
    return Array.from(groups.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([dateKey, data]) => ({
        title: formatSectionDate(new Date(dateKey)),
        date: new Date(dateKey),
        data,
      }));
  }, [entries]);

  /**
   * Handle entry press
   */
  const handleEntryPress = useCallback(
    (entry: TimeEntryWithApprovalAndUser) => {
      onEntryPress?.(entry);
    },
    [onEntryPress]
  );

  /**
   * Render section header
   */
  const renderSectionHeader = useCallback(
    ({ section }: { section: SubmissionSection }) => {
      const totalDuration = section.data.reduce((sum, e) => sum + e.duration_seconds, 0);

      return (
        <View style={[styles.sectionHeader, { backgroundColor: colors.background }]}>
          <Text variant="body" bold>
            {section.title}
          </Text>
          <Text variant="caption" color="secondary">
            {section.data.length} {section.data.length === 1 ? 'entry' : 'entries'} ·{' '}
            {formatDuration(totalDuration)}
          </Text>
        </View>
      );
    },
    [colors]
  );

  /**
   * Render entry item
   */
  const renderItem: SectionListRenderItem<TimeEntryWithApprovalAndUser, SubmissionSection> =
    useCallback(
      ({ item: entry }) => {
        return (
          <Card padding="md" style={styles.entryCard}>
            <Pressable
              onPress={() => handleEntryPress(entry)}
              style={styles.entryContent}
              accessibilityRole="button"
              accessibilityLabel={`View entry: ${entry.category?.name || 'Uncategorized'}, ${formatDuration(entry.duration_seconds)}`}
            >
              {/* Header row: Category/Project + Status badge */}
              <View style={styles.entryHeader}>
                <View style={styles.entryTitleRow}>
                  {entry.category && (
                    <View style={[styles.categoryDot, { backgroundColor: entry.category.color }]} />
                  )}
                  <Text variant="body" bold numberOfLines={1} style={styles.entryTitle}>
                    {entry.category?.name || entry.project?.name || 'Uncategorized'}
                  </Text>
                </View>
                <ApprovalStatusBadge status={entry.approval_status} size="small" />
              </View>

              {/* Project badge if different from category */}
              {entry.project && entry.category && (
                <View style={styles.projectRow}>
                  <View style={[styles.projectDot, { backgroundColor: entry.project.color }]} />
                  <Text variant="caption" color="secondary">
                    {entry.project.name}
                  </Text>
                </View>
              )}

              {/* Time range */}
              <View style={styles.timeRow}>
                <Text variant="caption" color="secondary">
                  {formatTime(entry.start_at)} -{' '}
                  {entry.end_at ? formatTime(entry.end_at) : 'Ongoing'}
                </Text>
                <Text variant="body" bold color="primary" style={styles.duration}>
                  {formatDuration(entry.duration_seconds)}
                </Text>
              </View>

              {/* Notes preview */}
              {entry.notes && (
                <Text variant="caption" color="muted" numberOfLines={1} style={styles.notes}>
                  {entry.notes}
                </Text>
              )}

              {/* Approval note (for rejected entries) */}
              {entry.approval_status === 'rejected' && entry.approval_note && (
                <View style={[styles.feedbackContainer, { backgroundColor: colors.error + '10' }]}>
                  <Text variant="caption" style={{ color: colors.error }}>
                    Feedback: {entry.approval_note}
                  </Text>
                </View>
              )}

              {/* Approval note (for approved entries) */}
              {entry.approval_status === 'approved' && entry.approval_note && (
                <View
                  style={[styles.feedbackContainer, { backgroundColor: colors.success + '10' }]}
                >
                  <Text variant="caption" style={{ color: colors.success }}>
                    Note: {entry.approval_note}
                  </Text>
                </View>
              )}
            </Pressable>
          </Card>
        );
      },
      [colors, handleEntryPress]
    );

  /**
   * Key extractor
   */
  const keyExtractor = useCallback((item: TimeEntryWithApprovalAndUser) => item.id, []);

  // Loading state
  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <Spinner size="large" />
        <Text variant="body" color="secondary" style={styles.loadingText}>
          Loading your submissions...
        </Text>
      </View>
    );
  }

  // Error state
  if (error) {
    return (
      <ErrorState
        title="Failed to Load"
        message={error.message || 'Could not load your submissions'}
        onRetry={() => void refetch()}
      />
    );
  }

  // Empty state
  if (!sections || sections.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Icon name="check-square" size={48} color={colors.textMuted} />
        <Text variant="heading" style={styles.emptyTitle}>
          No Submissions
        </Text>
        <Text variant="body" color="secondary" style={styles.emptyDescription}>
          You have not submitted any entries for approval yet
        </Text>
      </View>
    );
  }

  return (
    <SectionList
      sections={sections}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      renderSectionHeader={renderSectionHeader}
      contentContainerStyle={styles.listContent}
      stickySectionHeadersEnabled
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />
      }
      ItemSeparatorComponent={() => <View style={styles.itemSeparator} />}
      SectionSeparatorComponent={() => <View style={styles.sectionSeparator} />}
    />
  );
}

const styles = StyleSheet.create({
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  loadingText: {
    marginTop: spacing.md,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyTitle: {
    marginTop: spacing.md,
    textAlign: 'center',
  },
  emptyDescription: {
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  listContent: {
    paddingBottom: spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  sectionSeparator: {
    height: spacing.md,
  },
  itemSeparator: {
    height: spacing.sm,
  },
  entryCard: {
    marginHorizontal: spacing.md,
  },
  entryContent: {
    // Pressable content
  },
  entryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  entryTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: spacing.sm,
  },
  categoryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: spacing.xs,
  },
  entryTitle: {
    flex: 1,
  },
  projectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  projectDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: spacing.xs,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  duration: {
    marginLeft: spacing.sm,
  },
  notes: {
    marginTop: spacing.xs,
  },
  feedbackContainer: {
    marginTop: spacing.sm,
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
  },
});

export default SubmissionList;
