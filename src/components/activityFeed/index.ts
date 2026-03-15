/**
 * Activity Feed Components
 *
 * UI components for displaying workspace activity events.
 * These components work with the useActivityFeed hooks to display
 * real-time activity streams within workspaces.
 *
 * USAGE:
 * ```tsx
 * import {
 *   ActivityFeedList,
 *   ActivityEventItem,
 *   ActivityEventAvatar,
 *   ActivityEventDescription,
 * } from '@/components/activityFeed';
 *
 * // Full feed with infinite scroll and realtime
 * <ActivityFeedList
 *   workspaceId={workspace.id}
 *   onEventPress={handleEventPress}
 * />
 *
 * // Single event item
 * <ActivityEventItem event={event} onPress={handlePress} />
 *
 * // Avatar only
 * <ActivityEventAvatar name="John Doe" size={40} />
 *
 * // Description only
 * <ActivityEventDescription
 *   eventType="entry_logged"
 *   actorName="John"
 *   payload={{ duration_seconds: 3600 }}
 * />
 * ```
 */

// ActivityFeedList - Main feed component with infinite scroll
export { ActivityFeedList, type ActivityFeedListProps } from './ActivityFeedList';

// ActivityEventItem - Individual event display
export {
  ActivityEventItem,
  ActivityEventItemSkeleton,
  type ActivityEventItemProps,
  type ActivityEventItemSkeletonProps,
} from './ActivityEventItem';

// ActivityEventAvatar - User avatar with initials
export {
  ActivityEventAvatar,
  ActivityEventAvatarSkeleton,
  type ActivityEventAvatarProps,
  type ActivityEventAvatarSkeletonProps,
} from './ActivityEventAvatar';

// ActivityEventDescription - Formatted event text
export {
  ActivityEventDescription,
  getEventDescriptionText,
  type ActivityEventDescriptionProps,
} from './ActivityEventDescription';
