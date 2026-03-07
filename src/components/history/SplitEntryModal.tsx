/**
 * SplitEntryModal Component
 *
 * Modal for splitting a time entry into two parts at a user-specified point.
 */

import * as React from 'react';
import { useState, useCallback, useMemo } from 'react';
import { View, StyleSheet, Modal, Pressable } from 'react-native';
import { Text, Icon, Button } from '@/components/ui';
import { colors, spacing, fontSizes, borderRadius } from '@/theme';
import { useSplitTimeEntry } from '@/hooks/useTimeEntryMutations';
import type { TimeEntry } from '@/schemas';

export interface SplitEntryModalProps {
  visible: boolean;
  entry: TimeEntry | null;
  onClose: () => void;
  onSuccess?: () => void;
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

export function SplitEntryModal({
  visible,
  entry,
  onClose,
  onSuccess,
}: SplitEntryModalProps): React.ReactElement {
  const [splitPercent, setSplitPercent] = useState(50);

  const splitMutation = useSplitTimeEntry({
    onSuccess: () => {
      onClose();
      onSuccess?.();
    },
  });

  const splitAtSeconds = useMemo(() => {
    if (!entry) return 0;
    return Math.round((entry.duration_seconds * splitPercent) / 100);
  }, [entry, splitPercent]);

  const remainingSeconds = useMemo(() => {
    if (!entry) return 0;
    return entry.duration_seconds - splitAtSeconds;
  }, [entry, splitAtSeconds]);

  const handleSplit = useCallback(() => {
    if (!entry || splitAtSeconds <= 0 || splitAtSeconds >= entry.duration_seconds) return;
    splitMutation.mutate({ id: entry.id, splitAtSeconds });
  }, [entry, splitAtSeconds, splitMutation]);

  const handleDecrease = useCallback(() => {
    setSplitPercent(prev => Math.max(10, prev - 10));
  }, []);

  const handleIncrease = useCallback(() => {
    setSplitPercent(prev => Math.min(90, prev + 10));
  }, []);

  if (!entry) {
    return <View />;
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.content}>
          <View style={styles.header}>
            <Text variant="heading" style={styles.title}>
              Split Entry
            </Text>
            <Pressable
              onPress={onClose}
              style={styles.closeButton}
              accessibilityRole="button"
              accessibilityLabel="Close modal"
            >
              <Icon name="close" size={20} color={colors.text} />
            </Pressable>
          </View>

          <Text style={styles.description}>
            Total duration: {formatDuration(entry.duration_seconds)}
          </Text>

          {/* Split point control */}
          <View style={styles.splitControl}>
            <Pressable
              style={styles.adjustButton}
              onPress={handleDecrease}
              accessibilityRole="button"
              accessibilityLabel="Decrease split point"
            >
              <Text style={styles.adjustButtonText}>-</Text>
            </Pressable>
            <Text style={styles.percentText}>{splitPercent}%</Text>
            <Pressable
              style={styles.adjustButton}
              onPress={handleIncrease}
              accessibilityRole="button"
              accessibilityLabel="Increase split point"
            >
              <Text style={styles.adjustButtonText}>+</Text>
            </Pressable>
          </View>

          {/* Visual bar */}
          <View style={styles.barContainer}>
            <View style={[styles.barFirst, { flex: splitPercent }]} />
            <View style={styles.barDivider} />
            <View style={[styles.barSecond, { flex: 100 - splitPercent }]} />
          </View>

          {/* Duration labels */}
          <View style={styles.durationRow}>
            <Text style={styles.durationLabel}>Part 1: {formatDuration(splitAtSeconds)}</Text>
            <Text style={styles.durationLabel}>Part 2: {formatDuration(remainingSeconds)}</Text>
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            <Button variant="outline" onPress={onClose} style={styles.cancelBtn}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onPress={handleSplit}
              loading={splitMutation.isPending}
              style={styles.splitBtn}
            >
              Split
            </Button>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  content: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    width: '100%',
    maxWidth: 400,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  title: {
    fontSize: fontSizes.lg,
    fontWeight: '700',
    color: colors.text,
  },
  closeButton: {
    padding: spacing.xs,
  },
  description: {
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  splitControl: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  adjustButton: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surfaceVariant,
    justifyContent: 'center',
    alignItems: 'center',
  },
  adjustButtonText: {
    fontSize: fontSizes.xl,
    color: colors.text,
    fontWeight: '600',
  },
  percentText: {
    fontSize: fontSizes.xl,
    fontWeight: '700',
    color: colors.primary,
    minWidth: 60,
    textAlign: 'center',
  },
  barContainer: {
    flexDirection: 'row',
    height: 24,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  barFirst: {
    backgroundColor: colors.primary,
  },
  barDivider: {
    width: 3,
    backgroundColor: colors.surface,
  },
  barSecond: {
    backgroundColor: colors.primary + '60',
  },
  durationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  durationLabel: {
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  cancelBtn: {
    flex: 1,
  },
  splitBtn: {
    flex: 1,
  },
});

export default SplitEntryModal;
