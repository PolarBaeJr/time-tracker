/**
 * ProjectList Component
 *
 * Displays a list of project cards with filtering options (All, My Projects, Archived).
 * Includes empty state with create CTA and pull-to-refresh support.
 *
 * USAGE:
 * ```tsx
 * <ProjectList
 *   workspaceId={workspaceId}
 *   onProjectPress={(project) => openDetail(project)}
 *   onCreatePress={() => openCreateModal()}
 * />
 * ```
 *
 * SECURITY:
 * - RLS policies ensure only visible projects are returned
 * - User must be workspace member to see projects
 */

import * as React from 'react';
import { useState, useCallback, useMemo } from 'react';
import { View, FlatList, StyleSheet, type ListRenderItemInfo, type ViewStyle } from 'react-native';
import { Button, Spinner, Text } from '@/components/ui';
import { ProjectCard } from './ProjectCard';
import { useProjects } from '@/hooks';
import { useTheme } from '@/theme';
import { spacing } from '@/theme';
import type { ProjectWithStats } from '@/schemas';

/**
 * Filter options for project list
 */
export type ProjectFilter = 'all' | 'my-projects' | 'archived';

/**
 * Props for ProjectList component
 */
export interface ProjectListProps {
  /** Workspace ID to fetch projects for */
  workspaceId: string;
  /** Callback when a project is selected */
  onProjectPress: (project: ProjectWithStats) => void;
  /** Callback to create a new project */
  onCreatePress: () => void;
  /** Initial filter selection */
  initialFilter?: ProjectFilter;
}

/**
 * Filter button component for filter bar
 */
function FilterButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}): React.ReactElement {
  const { colors } = useTheme();

  const buttonStyle: ViewStyle = active
    ? { ...styles.filterButton, backgroundColor: colors.primary }
    : styles.filterButton;

  return (
    <Button variant={active ? 'primary' : 'ghost'} size="sm" onPress={onPress} style={buttonStyle}>
      {label}
    </Button>
  );
}

/**
 * Empty state component when no projects exist
 */
function EmptyState({
  filter,
  onCreatePress,
}: {
  filter: ProjectFilter;
  onCreatePress: () => void;
}): React.ReactElement {
  const getMessage = () => {
    switch (filter) {
      case 'archived':
        return 'No archived projects found.';
      case 'my-projects':
        return "You're not a member of any projects yet.";
      default:
        return 'No projects in this workspace yet.';
    }
  };

  const getSubMessage = () => {
    switch (filter) {
      case 'archived':
        return 'Archived projects will appear here.';
      case 'my-projects':
        return 'Create a project or ask to be added to an existing one.';
      default:
        return 'Create your first project to start tracking time together.';
    }
  };

  return (
    <View style={styles.emptyState}>
      <Text variant="heading" center style={styles.emptyTitle}>
        {getMessage()}
      </Text>
      <Text variant="body" color="secondary" center style={styles.emptyText}>
        {getSubMessage()}
      </Text>
      {filter !== 'archived' && (
        <Button variant="primary" onPress={onCreatePress} style={styles.emptyButton}>
          Create Project
        </Button>
      )}
    </View>
  );
}

/**
 * ProjectList component for displaying and filtering workspace projects
 */
export function ProjectList({
  workspaceId,
  onProjectPress,
  onCreatePress,
  initialFilter = 'all',
}: ProjectListProps): React.ReactElement {
  const { colors } = useTheme();
  const [filter, setFilter] = useState<ProjectFilter>(initialFilter);

  // Determine fetch options based on filter
  const fetchOptions = useMemo(() => {
    switch (filter) {
      case 'archived':
        return { includeArchived: true, memberOnly: false };
      case 'my-projects':
        return { includeArchived: false, memberOnly: true };
      default:
        return { includeArchived: false, memberOnly: false };
    }
  }, [filter]);

  const {
    data: projects,
    isLoading,
    error,
    refetch,
    isRefetching,
  } = useProjects(workspaceId, {
    ...fetchOptions,
    enabled: !!workspaceId,
  });

  // Filter projects client-side for archived view
  const filteredProjects = useMemo(() => {
    if (!projects) return [];

    if (filter === 'archived') {
      return projects.filter(p => p.is_archived);
    }

    return projects;
  }, [projects, filter]);

  // Render individual project item
  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<ProjectWithStats>) => (
      <ProjectCard project={item} onPress={onProjectPress} />
    ),
    [onProjectPress]
  );

  // Key extractor for FlatList
  const keyExtractor = useCallback((item: ProjectWithStats) => item.id, []);

  // Handle refresh
  const handleRefresh = useCallback(() => {
    void refetch();
  }, [refetch]);

  // Loading state
  if (isLoading && !projects) {
    return (
      <View style={styles.loadingContainer}>
        <Spinner size="large" message="Loading projects..." />
      </View>
    );
  }

  // Error state
  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text variant="body" color="error" center>
          Failed to load projects
        </Text>
        <Button variant="outline" size="sm" onPress={handleRefresh} style={styles.retryButton}>
          Retry
        </Button>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Filter bar */}
      <View style={[styles.filterBar, { backgroundColor: colors.surface }]}>
        <FilterButton label="All" active={filter === 'all'} onPress={() => setFilter('all')} />
        <FilterButton
          label="My Projects"
          active={filter === 'my-projects'}
          onPress={() => setFilter('my-projects')}
        />
        <FilterButton
          label="Archived"
          active={filter === 'archived'}
          onPress={() => setFilter('archived')}
        />
      </View>

      {/* Project list */}
      {filteredProjects.length === 0 ? (
        <EmptyState filter={filter} onCreatePress={onCreatePress} />
      ) : (
        <FlatList
          data={filteredProjects}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.listContent}
          onRefresh={handleRefresh}
          refreshing={isRefetching}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  retryButton: {
    marginTop: spacing.md,
  },
  filterBar: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  filterButton: {
    minWidth: 80,
  },
  listContent: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  separator: {
    height: spacing.sm,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyTitle: {
    marginBottom: spacing.md,
  },
  emptyText: {
    marginBottom: spacing.lg,
    maxWidth: 280,
  },
  emptyButton: {
    minWidth: 160,
  },
});

export default ProjectList;
