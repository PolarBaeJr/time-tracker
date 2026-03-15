/**
 * ApprovalQueue Component
 *
 * Displays a list of time entries pending approval (for approvers).
 * Entries are grouped by submitter with multi-select support.
 *
 * USAGE:
 * ```tsx
 * <ApprovalQueue
 *   workspaceId={workspaceId}
 *   onApprove={(entryIds) => handleApprove(entryIds)}
 *   onReject={(entryIds) => handleReject(entryIds)}
 * />
 * ```
 *
 * SECURITY:
 * - RLS policies ensure only assigned approvers can see entries
 */

import * as React from 'react';
import { useState, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  Pressable,
  type ListRenderItem,
} from 'react-native';
import { Text, Card, Icon, Button, Spinner, ErrorState } from '@/components/ui';
import { usePendingApprovals } from '@/hooks';
import { useTheme, spacing } from '@/theme';
import type { TimeEntryWithApprovalAndUser } from '@/schemas';

/**
 * Props for ApprovalQueue component
 */
export interface ApprovalQueueProps {
  /** Workspace ID to fetch approvals for */
  workspaceId: string;
  /** Callback when approve action is triggered */
  onApprove: (entryIds: string[]) => void;
  /** Callback when reject action is triggered */
  onReject: (entryIds: string[]) => void;
  /** Callback when an entry is tapped for detail view */
  onEntryPress?: (entry: TimeEntryWithApprovalAndUser) => void;
}

/**
 * Grouped entries by submitter
 */
interface SubmitterGroup {
  userId: string;
  userName: string;
  userEmail: string;
  entries: TimeEntryWithApprovalAndUser[];
  totalDuration: number;
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
 * Format date to readable string
 */
function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Format time from ISO string to HH:MM
 */
function formatTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

/**
 * ApprovalQueue component
 */
export function ApprovalQueue({
  workspaceId,
  onApprove,
  onReject,
  onEntryPress,
}: ApprovalQueueProps): React.ReactElement {
  const { colors } = useTheme();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const {
    data: entries,
    isLoading,
    isRefetching,
    refetch,
    error,
  } = usePendingApprovals(workspaceId);

  /**
   * Group entries by submitter
   */
  const groupedEntries = useMemo<SubmitterGroup[]>(() => {
    if (!entries || entries.length === 0) return [];

    const groups = new Map<string, SubmitterGroup>();

    for (const entry of entries) {
      const userId = entry.user_id;
      const existing = groups.get(userId);

      if (existing) {
        existing.entries.push(entry);
        existing.totalDuration += entry.duration_seconds;
      } else {
        groups.set(userId, {
          userId,
          userName: entry.user?.name || 'Unknown User',
          userEmail: entry.user?.email || '',
          entries: [entry],
          totalDuration: entry.duration_seconds,
        });
      }
    }

    // Sort groups by most recent submission
    return Array.from(groups.values()).sort((a, b) => {
      const aLatest = Math.max(...a.entries.map(e => new Date(e.submitted_at || 0).getTime()));
      const bLatest = Math.max(...b.entries.map(e => new Date(e.submitted_at || 0).getTime()));
      return bLatest - aLatest;
    });
  }, [entries]);

  /**
   * Toggle entry selection
   */
  const toggleSelection = useCallback((entryId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(entryId)) {
        next.delete(entryId);
      } else {
        next.add(entryId);
      }
      return next;
    });
  }, []);

  /**
   * Toggle all entries in a group
   */
  const toggleGroupSelection = useCallback((group: SubmitterGroup) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      const groupIds = group.entries.map(e => e.id);
      const allSelected = groupIds.every(id => prev.has(id));

      if (allSelected) {
        groupIds.forEach(id => next.delete(id));
      } else {
        groupIds.forEach(id => next.add(id));
      }
      return next;
    });
  }, []);

  /**
   * Toggle group expansion
   */
  const toggleGroupExpansion = useCallback((userId: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  }, []);

  /**
   * Handle approve action
   */
  const handleApprove = useCallback(() => {
    if (selectedIds.size > 0) {
      onApprove(Array.from(selectedIds));
      setSelectedIds(new Set());
    }
  }, [selectedIds, onApprove]);

  /**
   * Handle reject action
   */
  const handleReject = useCallback(() => {
    if (selectedIds.size > 0) {
      onReject(Array.from(selectedIds));
      setSelectedIds(new Set());
    }
  }, [selectedIds, onReject]);

  /**
   * Select all entries
   */
  const selectAll = useCallback(() => {
    if (!entries) return;
    setSelectedIds(new Set(entries.map(e => e.id)));
  }, [entries]);

  /**
   * Clear selection
   */
  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  /**
   * Render entry item
   */
  const renderEntry = useCallback(
    (entry: TimeEntryWithApprovalAndUser) => {
      const isSelected = selectedIds.has(entry.id);

      return (
        <Pressable
          key={entry.id}
          style={[
            styles.entryItem,
            { backgroundColor: colors.surface },
            isSelected && { backgroundColor: colors.surfaceVariant },
          ]}
          onPress={() => toggleSelection(entry.id)}
          onLongPress={() => onEntryPress?.(entry)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: isSelected }}
          accessibilityLabel={`Entry: ${formatDuration(entry.duration_seconds)} on ${formatDate(entry.start_at)}`}
        >
          <View style={styles.entryCheckbox}>
            <Icon
              name={isSelected ? 'checkbox-checked' : 'checkbox-blank'}
              size={20}
              color={isSelected ? colors.primary : colors.textSecondary}
            />
          </View>

          <View style={styles.entryContent}>
            <View style={styles.entryHeader}>
              <Text variant="body" bold numberOfLines={1} style={styles.entryCategory}>
                {entry.category?.name || entry.project?.name || 'Uncategorized'}
              </Text>
              {entry.project && (
                <View style={[styles.projectDot, { backgroundColor: entry.project.color }]} />
              )}
            </View>

            <View style={styles.entryMeta}>
              <Text variant="caption" color="secondary">
                {formatDate(entry.start_at)} · {formatTime(entry.start_at)} -{' '}
                {entry.end_at ? formatTime(entry.end_at) : 'Ongoing'}
              </Text>
            </View>

            {entry.notes && (
              <Text variant="caption" color="muted" numberOfLines={1} style={styles.entryNotes}>
                {entry.notes}
              </Text>
            )}
          </View>

          <View style={styles.entryDuration}>
            <Text variant="body" bold color="primary">
              {formatDuration(entry.duration_seconds)}
            </Text>
          </View>
        </Pressable>
      );
    },
    [selectedIds, colors, toggleSelection, onEntryPress]
  );

  /**
   * Render submitter group
   */
  const renderGroup: ListRenderItem<SubmitterGroup> = useCallback(
    ({ item: group }) => {
      const isExpanded = expandedGroups.has(group.userId);
      const groupSelected = group.entries.filter(e => selectedIds.has(e.id)).length;
      const allSelected = groupSelected === group.entries.length;

      return (
        <Card padding="none" style={styles.groupCard}>
          {/* Group header */}
          <Pressable
            style={[styles.groupHeader, { borderBottomColor: colors.border }]}
            onPress={() => toggleGroupExpansion(group.userId)}
            accessibilityRole="button"
            accessibilityLabel={`${group.userName}: ${group.entries.length} entries`}
          >
            <Pressable
              style={styles.groupCheckbox}
              onPress={() => toggleGroupSelection(group)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: allSelected }}
              accessibilityLabel={allSelected ? 'Deselect all' : 'Select all'}
            >
              <Icon
                name={allSelected ? 'checkbox-checked' : 'checkbox-blank'}
                size={22}
                color={allSelected ? colors.primary : colors.textSecondary}
              />
            </Pressable>

            <View style={styles.groupInfo}>
              <Text variant="body" bold numberOfLines={1}>
                {group.userName}
              </Text>
              <Text variant="caption" color="secondary">
                {group.entries.length} {group.entries.length === 1 ? 'entry' : 'entries'} ·{' '}
                {formatDuration(group.totalDuration)}
              </Text>
            </View>

            <Icon
              name={isExpanded ? 'chevron-up' : 'chevron-down'}
              size={20}
              color={colors.textSecondary}
            />
          </Pressable>

          {/* Expanded entries */}
          {isExpanded && (
            <View style={styles.entriesList}>{group.entries.map(entry => renderEntry(entry))}</View>
          )}
        </Card>
      );
    },
    [expandedGroups, selectedIds, colors, toggleGroupExpansion, toggleGroupSelection, renderEntry]
  );

  // Loading state
  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <Spinner size="large" />
        <Text variant="body" color="secondary" style={styles.loadingText}>
          Loading pending approvals...
        </Text>
      </View>
    );
  }

  // Error state
  if (error) {
    return (
      <ErrorState
        title="Failed to Load"
        message={error.message || 'Could not load pending approvals'}
        onRetry={() => void refetch()}
      />
    );
  }

  // Empty state
  if (!groupedEntries || groupedEntries.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Icon name="check" size={48} color={colors.textMuted} />
        <Text variant="heading" style={styles.emptyTitle}>
          All Caught Up!
        </Text>
        <Text variant="body" color="secondary" style={styles.emptyDescription}>
          You have no entries pending your approval
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Selection toolbar */}
      {selectedIds.size > 0 && (
        <View style={[styles.toolbar, { backgroundColor: colors.surfaceVariant }]}>
          <Text variant="body" style={styles.toolbarText}>
            {selectedIds.size} selected
          </Text>

          <View style={styles.toolbarActions}>
            <Button variant="ghost" size="sm" onPress={clearSelection}>
              Clear
            </Button>
            <Button variant="ghost" size="sm" onPress={selectAll}>
              Select All
            </Button>
          </View>
        </View>
      )}

      {/* Grouped entries list */}
      <FlatList
        data={groupedEntries}
        keyExtractor={item => item.userId}
        renderItem={renderGroup}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={colors.primary}
          />
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />

      {/* Action buttons */}
      {selectedIds.size > 0 && (
        <View
          style={[
            styles.actionBar,
            { backgroundColor: colors.surface, borderTopColor: colors.border },
          ]}
        >
          <Button
            variant="outline"
            onPress={handleReject}
            style={styles.rejectButton}
            accessibilityLabel={`Reject ${selectedIds.size} entries`}
          >
            Reject
          </Button>
          <Button
            variant="primary"
            onPress={handleApprove}
            style={styles.approveButton}
            accessibilityLabel={`Approve ${selectedIds.size} entries`}
          >
            Approve ({selectedIds.size})
          </Button>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
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
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  toolbarText: {
    fontWeight: '600',
  },
  toolbarActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  listContent: {
    padding: spacing.md,
    paddingBottom: 100, // Space for action bar
  },
  separator: {
    height: spacing.sm,
  },
  groupCard: {
    overflow: 'hidden',
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
  },
  groupCheckbox: {
    marginRight: spacing.md,
  },
  groupInfo: {
    flex: 1,
  },
  entriesList: {
    // Entries container
  },
  entryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  entryCheckbox: {
    marginRight: spacing.sm,
  },
  entryContent: {
    flex: 1,
  },
  entryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  entryCategory: {
    flex: 1,
  },
  projectDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: spacing.xs,
  },
  entryMeta: {
    marginTop: 2,
  },
  entryNotes: {
    marginTop: 4,
  },
  entryDuration: {
    marginLeft: spacing.sm,
  },
  actionBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    padding: spacing.md,
    borderTopWidth: 1,
    gap: spacing.sm,
  },
  rejectButton: {
    flex: 1,
  },
  approveButton: {
    flex: 2,
  },
});

export default ApprovalQueue;
