/**
 * AchievementList Component
 *
 * Displays a grid or list of all achievements.
 *
 * Features:
 * - Grid layout for badge display
 * - Category filtering/tabs
 * - Unlocked/locked sections
 * - Staggered animation on mount
 * - Pull-to-refresh for recalculation
 * - Theme-aware styling
 */

import * as React from 'react';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { Card } from '@/components/ui/Card';
import { AnimatedView } from '@/components/ui/AnimatedView';
import { AchievementBadge, type AchievementBadgeProps } from './AchievementBadge';
import { useTheme, spacing, borderRadius } from '@/theme';
import { useUXSettingsSelector } from '@/stores/uxSettingsStore';
import { useAchievements } from '@/hooks/useAchievements';
import type { Achievement, AchievementCategory } from '@/schemas/achievement';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Display mode for the achievement list
 */
export type AchievementListMode = 'grid' | 'list';

/**
 * Filter for showing achievements
 */
export type AchievementFilter = 'all' | 'unlocked' | 'locked';

/**
 * Props for the AchievementList component
 */
export interface AchievementListProps {
  /** Display mode (default: 'grid') */
  mode?: AchievementListMode;
  /** Filter for achievements (default: 'all') */
  filter?: AchievementFilter;
  /** Category filter (optional) */
  category?: AchievementCategory;
  /** Whether to show category headers/tabs */
  showCategoryTabs?: boolean;
  /** Whether to animate items on mount */
  animateOnMount?: boolean;
  /** Callback when an achievement is pressed */
  onAchievementPress?: (achievement: Achievement) => void;
  /** Badge size variant */
  badgeSize?: AchievementBadgeProps['size'];
  /** Whether to show progress on badges */
  showProgress?: boolean;
  /** Number of columns for grid mode (default: 3) */
  numColumns?: number;
  /** Custom empty message */
  emptyMessage?: string;
  /** Test ID for testing */
  testID?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const CATEGORY_LABELS: Record<AchievementCategory, string> = {
  streak: 'Streaks',
  time: 'Time',
  first: 'Firsts',
};

const CATEGORY_ORDER: AchievementCategory[] = ['first', 'streak', 'time'];

// ============================================================================
// CATEGORY TAB COMPONENT
// ============================================================================

interface CategoryTabProps {
  category: AchievementCategory | null;
  label: string;
  isSelected: boolean;
  onPress: () => void;
  count: number;
}

function CategoryTab({
  category,
  label,
  isSelected,
  onPress,
  count,
}: CategoryTabProps): React.ReactElement {
  const { colors, isDark } = useTheme();

  const backgroundColor = isSelected
    ? colors.primary
    : isDark
      ? 'rgba(255, 255, 255, 0.08)'
      : 'rgba(0, 0, 0, 0.04)';
  const textColor = isSelected ? '#FFFFFF' : colors.text;

  return (
    <AnimatedView preset="fadeIn">
      <View
        style={[
          styles.categoryTab,
          {
            backgroundColor,
            borderColor: isSelected ? colors.primary : colors.border,
          },
        ]}
        accessibilityRole="tab"
        accessibilityState={{ selected: isSelected }}
      >
        <Text
          style={[styles.categoryTabText, { color: textColor }]}
          onPress={onPress}
          accessibilityLabel={`${label} (${count})`}
        >
          {label} ({count})
        </Text>
      </View>
    </AnimatedView>
  );
}

// ============================================================================
// ACHIEVEMENT SECTION COMPONENT
// ============================================================================

interface AchievementSectionProps {
  title: string;
  achievements: Achievement[];
  onAchievementPress?: (achievement: Achievement) => void;
  badgeSize: AchievementBadgeProps['size'];
  showProgress: boolean;
  numColumns: number;
  animateOnMount: boolean;
}

function AchievementSection({
  title,
  achievements,
  onAchievementPress,
  badgeSize,
  showProgress,
  numColumns,
  animateOnMount,
}: AchievementSectionProps): React.ReactElement | null {
  const { colors, isDark } = useTheme();

  if (achievements.length === 0) {
    return null;
  }

  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{title}</Text>
      <View style={styles.gridContainer}>
        {achievements.map((achievement, index) => (
          <AnimatedView
            key={achievement.id}
            preset={animateOnMount ? 'scaleIn' : 'none'}
            delay={animateOnMount ? index * 50 : 0}
          >
            <AchievementBadge
              achievement={achievement}
              size={badgeSize}
              showProgress={showProgress}
              onPress={onAchievementPress}
              testID={`achievement-badge-${achievement.id}`}
            />
          </AnimatedView>
        ))}
      </View>
    </View>
  );
}

// ============================================================================
// ACHIEVEMENT LIST COMPONENT
// ============================================================================

/**
 * AchievementList Component
 *
 * Displays a grid or list of all achievements with filtering and animations.
 *
 * @example
 * ```tsx
 * // Basic grid
 * <AchievementList />
 *
 * // With category tabs and filtering
 * <AchievementList
 *   showCategoryTabs
 *   filter="unlocked"
 *   onAchievementPress={(a) => showDetail(a)}
 * />
 *
 * // List mode
 * <AchievementList mode="list" badgeSize="lg" />
 * ```
 */
export function AchievementList({
  mode = 'grid',
  filter = 'all',
  category: initialCategory,
  showCategoryTabs = false,
  animateOnMount = true,
  onAchievementPress,
  badgeSize = 'md',
  showProgress = true,
  numColumns = 3,
  emptyMessage,
  testID,
}: AchievementListProps): React.ReactElement {
  const { colors, isDark } = useTheme();
  const animationsEnabled = useUXSettingsSelector(s => s.animationsEnabled);

  // State for category filter
  const [selectedCategory, setSelectedCategory] = useState<AchievementCategory | null>(
    initialCategory ?? null
  );

  // Get achievements data
  const { achievements, unlockedAchievements, lockedAchievements, isCalculating, recalculate } =
    useAchievements({
      category: selectedCategory ?? undefined,
    });

  // Filter achievements based on filter prop
  const filteredAchievements = useMemo(() => {
    switch (filter) {
      case 'unlocked':
        return unlockedAchievements;
      case 'locked':
        return lockedAchievements;
      default:
        return achievements;
    }
  }, [filter, achievements, unlockedAchievements, lockedAchievements]);

  // Group achievements by category
  const groupedAchievements = useMemo(() => {
    const groups: Record<AchievementCategory, Achievement[]> = {
      first: [],
      streak: [],
      time: [],
    };

    for (const achievement of filteredAchievements) {
      groups[achievement.category].push(achievement);
    }

    return groups;
  }, [filteredAchievements]);

  // Get category counts for tabs
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: achievements.length };
    for (const cat of CATEGORY_ORDER) {
      counts[cat] = achievements.filter(a => a.category === cat).length;
    }
    return counts;
  }, [achievements]);

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    await recalculate();
  }, [recalculate]);

  // Empty state
  const renderEmpty = useCallback(() => {
    const message =
      emptyMessage ??
      (filter === 'unlocked'
        ? 'No achievements unlocked yet. Keep tracking!'
        : filter === 'locked'
          ? 'All achievements unlocked!'
          : 'No achievements available.');

    return (
      <View style={styles.emptyContainer}>
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{message}</Text>
      </View>
    );
  }, [emptyMessage, filter, colors]);

  // Render grid content
  const renderGridContent = useCallback(() => {
    if (filteredAchievements.length === 0) {
      return renderEmpty();
    }

    // If showing by category (no specific filter)
    if (!selectedCategory && filter === 'all') {
      return (
        <View>
          {CATEGORY_ORDER.map(cat => (
            <AchievementSection
              key={cat}
              title={CATEGORY_LABELS[cat]}
              achievements={groupedAchievements[cat]}
              onAchievementPress={onAchievementPress}
              badgeSize={badgeSize}
              showProgress={showProgress}
              numColumns={numColumns}
              animateOnMount={animateOnMount && animationsEnabled}
            />
          ))}
        </View>
      );
    }

    // Flat grid
    return (
      <View style={styles.gridContainer}>
        {filteredAchievements.map((achievement, index) => (
          <AnimatedView
            key={achievement.id}
            preset={animateOnMount && animationsEnabled ? 'scaleIn' : 'none'}
            delay={animateOnMount && animationsEnabled ? index * 50 : 0}
          >
            <AchievementBadge
              achievement={achievement}
              size={badgeSize}
              showProgress={showProgress}
              onPress={onAchievementPress}
              testID={`achievement-badge-${achievement.id}`}
            />
          </AnimatedView>
        ))}
      </View>
    );
  }, [
    filteredAchievements,
    selectedCategory,
    filter,
    groupedAchievements,
    onAchievementPress,
    badgeSize,
    showProgress,
    numColumns,
    animateOnMount,
    animationsEnabled,
    renderEmpty,
  ]);

  // Render list item for list mode
  const renderListItem = useCallback(
    ({ item, index }: { item: Achievement; index: number }) => (
      <AnimatedView
        preset={animateOnMount && animationsEnabled ? 'slideUp' : 'none'}
        delay={animateOnMount && animationsEnabled ? index * 50 : 0}
      >
        <Card
          padding="md"
          elevation="sm"
          pressable={!!onAchievementPress}
          onPress={() => onAchievementPress?.(item)}
          style={styles.listCard}
        >
          <View style={styles.listItemContent}>
            <AchievementBadge
              achievement={item}
              size="sm"
              showProgress={false}
              showDescription={false}
            />
            <View style={styles.listItemText}>
              <Text
                style={[
                  styles.listItemTitle,
                  { color: item.isUnlocked ? colors.text : colors.textSecondary },
                ]}
              >
                {item.name}
              </Text>
              <Text style={[styles.listItemDescription, { color: colors.textSecondary }]}>
                {item.description}
              </Text>
              {!item.isUnlocked && showProgress && (
                <View style={styles.listProgressContainer}>
                  <View
                    style={[
                      styles.listProgressBar,
                      { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' },
                    ]}
                  >
                    <View
                      style={[
                        styles.listProgressFill,
                        {
                          width: `${Math.min(item.progressPercent, 100)}%`,
                          backgroundColor: colors.primary,
                        },
                      ]}
                    />
                  </View>
                  <Text style={[styles.listProgressText, { color: colors.textSecondary }]}>
                    {Math.floor(item.progressPercent)}%
                  </Text>
                </View>
              )}
            </View>
          </View>
        </Card>
      </AnimatedView>
    ),
    [onAchievementPress, animateOnMount, animationsEnabled, colors, isDark, showProgress]
  );

  return (
    <View style={styles.container} testID={testID}>
      {/* Category Tabs */}
      {showCategoryTabs && (
        <View style={styles.tabsContainer}>
          <CategoryTab
            category={null}
            label="All"
            isSelected={selectedCategory === null}
            onPress={() => setSelectedCategory(null)}
            count={categoryCounts.all}
          />
          {CATEGORY_ORDER.map(cat => (
            <CategoryTab
              key={cat}
              category={cat}
              label={CATEGORY_LABELS[cat]}
              isSelected={selectedCategory === cat}
              onPress={() => setSelectedCategory(cat)}
              count={categoryCounts[cat]}
            />
          ))}
        </View>
      )}

      {/* Grid Mode */}
      {mode === 'grid' && (
        <FlatList
          data={[{ key: 'content' }]}
          renderItem={() => renderGridContent()}
          refreshControl={
            <RefreshControl
              refreshing={isCalculating}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          accessibilityRole="list"
          accessibilityLabel="Achievements"
        />
      )}

      {/* List Mode */}
      {mode === 'list' && (
        <FlatList
          data={filteredAchievements}
          renderItem={renderListItem}
          keyExtractor={item => item.id}
          refreshControl={
            <RefreshControl
              refreshing={isCalculating}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.listSeparator} />}
          ListEmptyComponent={renderEmpty}
          showsVerticalScrollIndicator={false}
          accessibilityRole="list"
          accessibilityLabel="Achievements"
        />
      )}
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  categoryTab: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  categoryTabText: {
    fontSize: 13,
    fontWeight: '500',
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    marginHorizontal: -spacing.xs,
  },
  listContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
  },
  listCard: {
    // Card styles handled by Card component
  },
  listItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  listItemText: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  listItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  listItemDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
  listProgressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  listProgressBar: {
    flex: 1,
    height: 4,
    borderRadius: borderRadius.full,
    overflow: 'hidden',
  },
  listProgressFill: {
    height: '100%',
    borderRadius: borderRadius.full,
  },
  listProgressText: {
    fontSize: 11,
    marginLeft: spacing.sm,
    minWidth: 32,
    textAlign: 'right',
  },
  listSeparator: {
    height: spacing.sm,
  },
  emptyContainer: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 14,
  },
});

export default AchievementList;
