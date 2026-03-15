/**
 * ApprovalStatusBadge Component
 *
 * Renders a colored badge indicating the approval status of a time entry.
 * Colors: draft=gray, submitted=yellow, approved=green, rejected=red
 *
 * USAGE:
 * ```tsx
 * <ApprovalStatusBadge status="submitted" />
 * <ApprovalStatusBadge status="approved" size="small" />
 * ```
 */

import * as React from 'react';
import { View, StyleSheet, type ViewStyle, type TextStyle } from 'react-native';
import { Text } from '@/components/ui';
import { useTheme } from '@/theme';
import { spacing, borderRadius, fontSizes } from '@/theme';
import type { ApprovalStatus } from '@/schemas';

/**
 * Props for ApprovalStatusBadge component
 */
export interface ApprovalStatusBadgeProps {
  /** The approval status to display */
  status: ApprovalStatus;
  /** Badge size variant */
  size?: 'small' | 'default';
  /** Additional styles for the badge container */
  style?: ViewStyle;
}

/**
 * Status color mapping
 */
const STATUS_COLORS = {
  draft: {
    bg: '#6B7280', // gray-500
    text: '#FFFFFF',
  },
  submitted: {
    bg: '#F59E0B', // amber-500
    text: '#FFFFFF',
  },
  approved: {
    bg: '#10B981', // emerald-500
    text: '#FFFFFF',
  },
  rejected: {
    bg: '#EF4444', // red-500
    text: '#FFFFFF',
  },
} as const;

/**
 * Status label mapping
 */
const STATUS_LABELS: Record<ApprovalStatus, string> = {
  draft: 'Draft',
  submitted: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
};

/**
 * ApprovalStatusBadge component displaying approval status
 */
export function ApprovalStatusBadge({
  status,
  size = 'default',
  style,
}: ApprovalStatusBadgeProps): React.ReactElement {
  // Status colors are hardcoded; useTheme call kept for consistency with other components
  useTheme();
  const statusColor = STATUS_COLORS[status] || STATUS_COLORS.draft;
  const label = STATUS_LABELS[status] || 'Unknown';

  const isSmall = size === 'small';

  const badgeStyle: ViewStyle = {
    ...styles.badge,
    ...(isSmall ? styles.badgeSmall : {}),
    backgroundColor: statusColor.bg,
    ...style,
  };

  const textStyle: TextStyle = {
    ...styles.text,
    ...(isSmall ? styles.textSmall : {}),
    color: statusColor.text,
  };

  return (
    <View style={badgeStyle} accessibilityRole="text" accessibilityLabel={`Status: ${label}`}>
      <Text style={textStyle}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
    alignSelf: 'flex-start',
  },
  badgeSmall: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
  },
  text: {
    fontSize: fontSizes.sm,
    fontWeight: '600',
  },
  textSmall: {
    fontSize: fontSizes.xs,
  },
});

export default ApprovalStatusBadge;
