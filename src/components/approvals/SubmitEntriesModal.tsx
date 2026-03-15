/**
 * SubmitEntriesModal Component
 *
 * Modal for selecting a date range and previewing entries to submit for approval.
 * Shows current approver assignment and confirms submission.
 *
 * USAGE:
 * ```tsx
 * <SubmitEntriesModal
 *   visible={showModal}
 *   workspaceId={workspaceId}
 *   entries={draftEntries}
 *   onSubmit={(entryIds) => handleSubmit(entryIds)}
 *   onClose={() => setShowModal(false)}
 * />
 * ```
 *
 * SECURITY:
 * - Only shows user's own draft entries
 * - Validates approver assignment exists before submission
 */

import * as React from 'react';
import { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  Pressable,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { Text, Button, Icon, Spinner } from '@/components/ui';
import { useApprovalAssignments, useSession } from '@/hooks';
import { useTheme } from '@/theme';
import { spacing, borderRadius, fontSizes } from '@/theme';
import type { TimeEntry } from '@/schemas';

/**
 * Props for SubmitEntriesModal component
 */
export interface SubmitEntriesModalProps {
  /** Whether the modal is visible */
  visible: boolean;
  /** Workspace ID */
  workspaceId: string;
  /** Draft entries available for submission */
  entries: TimeEntry[];
  /** Whether submission is in progress */
  isSubmitting?: boolean;
  /** Callback when entries are submitted */
  onSubmit: (entryIds: string[]) => void;
  /** Callback when modal is closed */
  onClose: () => void;
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
    weekday: 'short',
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
 * SubmitEntriesModal component
 */
export function SubmitEntriesModal({
  visible,
  workspaceId,
  entries,
  isSubmitting = false,
  onSubmit,
  onClose,
}: SubmitEntriesModalProps): React.ReactElement {
  const { colors } = useTheme();
  const { session } = useSession();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const { data: assignments, isLoading: loadingAssignments } = useApprovalAssignments(workspaceId, {
    enabled: visible,
  });

  /**
   * Find current user's approver
   */
  const userId = session?.user?.id;
  const myApprover = useMemo(() => {
    if (!assignments || !userId) return null;
    const assignment = assignments.find(a => a.member_user_id === userId);
    return assignment?.approver ?? null;
  }, [assignments, userId]);

  /**
   * Reset selection when modal opens/closes
   * Using a microtask to avoid synchronous setState within effect
   */
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!visible) {
        setSelectedIds(new Set());
      } else {
        // Auto-select all entries when modal opens
        setSelectedIds(new Set(entries.map(e => e.id)));
      }
    }, 0);
    return () => clearTimeout(timeout);
  }, [visible, entries]);

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
   * Select all entries
   */
  const selectAll = useCallback(() => {
    setSelectedIds(new Set(entries.map(e => e.id)));
  }, [entries]);

  /**
   * Clear selection
   */
  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  /**
   * Calculate totals
   */
  const totals = useMemo(() => {
    const selected = entries.filter(e => selectedIds.has(e.id));
    return {
      count: selected.length,
      duration: selected.reduce((sum, e) => sum + e.duration_seconds, 0),
    };
  }, [entries, selectedIds]);

  /**
   * Handle submit
   */
  const handleSubmit = useCallback(() => {
    if (!myApprover) {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.alert('No approver assigned. Please contact your workspace admin.');
      } else {
        Alert.alert('No Approver', 'No approver assigned. Please contact your workspace admin.');
      }
      return;
    }

    if (selectedIds.size === 0) {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.alert('Please select at least one entry to submit.');
      } else {
        Alert.alert('No Entries Selected', 'Please select at least one entry to submit.');
      }
      return;
    }

    onSubmit(Array.from(selectedIds));
  }, [myApprover, selectedIds, onSubmit]);

  /**
   * Handle close
   */
  const handleClose = useCallback(() => {
    if (!isSubmitting) {
      onClose();
    }
  }, [isSubmitting, onClose]);

  /**
   * Render entry item
   */
  const renderEntry = useCallback(
    ({ item: entry }: { item: TimeEntry }) => {
      const isSelected = selectedIds.has(entry.id);

      return (
        <Pressable
          style={[
            styles.entryItem,
            { backgroundColor: colors.surface },
            isSelected && { backgroundColor: colors.surfaceVariant },
          ]}
          onPress={() => toggleSelection(entry.id)}
          disabled={isSubmitting}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: isSelected }}
          accessibilityLabel={`Entry on ${formatDate(entry.start_at)}, ${formatDuration(entry.duration_seconds)}`}
        >
          <View style={styles.checkbox}>
            <Icon
              name={isSelected ? 'checkbox-checked' : 'checkbox-blank'}
              size={22}
              color={isSelected ? colors.primary : colors.textSecondary}
            />
          </View>

          <View style={styles.entryContent}>
            <Text variant="body" numberOfLines={1}>
              {formatDate(entry.start_at)}
            </Text>
            <Text variant="caption" color="secondary">
              {formatTime(entry.start_at)} - {entry.end_at ? formatTime(entry.end_at) : 'Ongoing'}
            </Text>
            {entry.notes && (
              <Text variant="caption" color="muted" numberOfLines={1}>
                {entry.notes}
              </Text>
            )}
          </View>

          <Text variant="body" bold color="primary">
            {formatDuration(entry.duration_seconds)}
          </Text>
        </Pressable>
      );
    },
    [selectedIds, colors, toggleSelection, isSubmitting]
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={[styles.overlay, { backgroundColor: colors.overlay }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.content, { backgroundColor: colors.surface }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <Text variant="heading" style={styles.title}>
              Submit for Approval
            </Text>
            <Pressable
              onPress={handleClose}
              style={styles.closeButton}
              disabled={isSubmitting}
              accessibilityRole="button"
              accessibilityLabel="Close modal"
            >
              <Icon name="close" size={24} color={colors.text} />
            </Pressable>
          </View>

          {/* Approver info */}
          <View style={[styles.approverSection, { backgroundColor: colors.surfaceVariant }]}>
            {loadingAssignments ? (
              <View style={styles.approverLoading}>
                <Spinner size="small" />
                <Text variant="caption" color="secondary" style={styles.approverLoadingText}>
                  Loading approver...
                </Text>
              </View>
            ) : myApprover ? (
              <View style={styles.approverInfo}>
                <Text variant="caption" color="secondary">
                  Will be reviewed by:
                </Text>
                <Text variant="body" bold>
                  {myApprover.name || myApprover.email}
                </Text>
              </View>
            ) : (
              <View style={styles.approverInfo}>
                <Icon name="alert" size={18} color={colors.warning} />
                <Text variant="body" style={{ color: colors.warning, marginLeft: spacing.xs }}>
                  No approver assigned
                </Text>
              </View>
            )}
          </View>

          {/* Selection toolbar */}
          <View style={[styles.toolbar, { borderBottomColor: colors.border }]}>
            <Text variant="body">
              {selectedIds.size} of {entries.length} selected
            </Text>
            <View style={styles.toolbarActions}>
              <Button variant="ghost" size="sm" onPress={clearSelection} disabled={isSubmitting}>
                Clear
              </Button>
              <Button variant="ghost" size="sm" onPress={selectAll} disabled={isSubmitting}>
                Select All
              </Button>
            </View>
          </View>

          {/* Entry list */}
          {entries.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Icon name="check" size={48} color={colors.textMuted} />
              <Text variant="heading" style={styles.emptyTitle}>
                No Draft Entries
              </Text>
              <Text variant="body" color="secondary" style={styles.emptyDescription}>
                All your entries have already been submitted or approved
              </Text>
            </View>
          ) : (
            <FlatList
              data={entries}
              keyExtractor={item => item.id}
              renderItem={renderEntry}
              contentContainerStyle={styles.listContent}
              ItemSeparatorComponent={() => (
                <View style={[styles.separator, { backgroundColor: colors.border }]} />
              )}
            />
          )}

          {/* Footer */}
          <View style={[styles.footer, { borderTopColor: colors.border }]}>
            <View style={styles.totalInfo}>
              <Text variant="caption" color="secondary">
                Total Duration
              </Text>
              <Text variant="heading" color="primary">
                {formatDuration(totals.duration)}
              </Text>
            </View>

            <Button
              variant="primary"
              onPress={handleSubmit}
              loading={isSubmitting}
              disabled={isSubmitting || selectedIds.size === 0 || !myApprover}
              style={styles.submitButton}
            >
              Submit {totals.count > 0 ? `(${totals.count})` : ''}
            </Button>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  content: {
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    maxHeight: '90%',
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: fontSizes.lg,
  },
  closeButton: {
    padding: spacing.xs,
  },
  approverSection: {
    padding: spacing.md,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    borderRadius: borderRadius.md,
  },
  approverLoading: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  approverLoadingText: {
    marginLeft: spacing.sm,
  },
  approverInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
  },
  toolbarActions: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  listContent: {
    paddingVertical: spacing.sm,
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
  entryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  checkbox: {
    marginRight: spacing.md,
  },
  entryContent: {
    flex: 1,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: spacing.lg + 22 + spacing.md, // Align with content
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    borderTopWidth: 1,
    gap: spacing.lg,
  },
  totalInfo: {
    flex: 1,
  },
  submitButton: {
    minWidth: 120,
  },
});

export default SubmitEntriesModal;
