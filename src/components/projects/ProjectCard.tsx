/**
 * ProjectCard Component
 *
 * Displays a single project as a card with color indicator, name, member count,
 * and archived badge if applicable. Pressable to open project detail.
 *
 * USAGE:
 * ```tsx
 * <ProjectCard
 *   project={project}
 *   onPress={() => openDetail(project)}
 * />
 * ```
 */

import * as React from 'react';
import { useCallback } from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';
import { Card, Text } from '@/components/ui';
import { useTheme } from '@/theme';
import { spacing, borderRadius } from '@/theme';
import type { ProjectWithStats } from '@/schemas';

/**
 * Props for ProjectCard component
 */
export interface ProjectCardProps {
  /** Project data to display */
  project: ProjectWithStats;
  /** Callback when card is pressed */
  onPress: (project: ProjectWithStats) => void;
  /** Additional styles for the card container */
  style?: ViewStyle;
}

/**
 * ProjectCard component displaying a project with color, name, and stats
 */
export function ProjectCard({ project, onPress, style }: ProjectCardProps): React.ReactElement {
  const { colors } = useTheme();

  const handlePress = useCallback(() => {
    onPress(project);
  }, [project, onPress]);

  // Combine styles properly for ViewStyle type
  const combinedStyle: ViewStyle = { ...styles.card, ...style };

  return (
    <Card
      pressable
      onPress={handlePress}
      padding="md"
      elevation="sm"
      style={combinedStyle}
      accessibilityRole="button"
      accessibilityLabel={`Open project ${project.name}`}
    >
      <View style={styles.cardContent}>
        {/* Color indicator */}
        <View style={[styles.colorIndicator, { backgroundColor: project.color }]} />

        {/* Project info */}
        <View style={styles.projectInfo}>
          <View style={styles.nameRow}>
            <Text variant="body" bold numberOfLines={1} style={styles.name}>
              {project.name}
            </Text>
            {project.is_archived && (
              <View style={[styles.archivedBadge, { backgroundColor: colors.surfaceVariant }]}>
                <Text variant="caption" color="muted">
                  Archived
                </Text>
              </View>
            )}
          </View>

          <View style={styles.metaRow}>
            {/* Member count */}
            <Text variant="caption" color="secondary">
              {project.member_count ?? 0} {project.member_count === 1 ? 'member' : 'members'}
            </Text>

            {/* Current user role badge */}
            {project.current_user_role && (
              <View style={[styles.roleBadge, { backgroundColor: colors.surfaceVariant }]}>
                <Text variant="caption" color="secondary">
                  {project.current_user_role}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Chevron indicator */}
        <Text color="muted" style={styles.chevron}>
          {'>'}
        </Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    // Card background handled by Card component
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  colorIndicator: {
    width: 4,
    height: 48,
    borderRadius: borderRadius.sm,
    marginRight: spacing.md,
  },
  projectInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  name: {
    flex: 1,
  },
  archivedBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
    gap: spacing.sm,
  },
  roleBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  chevron: {
    fontSize: 20,
    marginLeft: spacing.sm,
  },
});

export default ProjectCard;
