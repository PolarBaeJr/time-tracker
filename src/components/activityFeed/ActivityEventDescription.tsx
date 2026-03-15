/**
 * ActivityEventDescription Component
 *
 * Renders formatted event description text based on event type and payload.
 * Features:
 * - Event-type specific formatting
 * - Bold actor names
 * - Styled project/entry references
 * - Duration formatting
 *
 * Event type formatters:
 * - timer_started: "Alice started timer on Project X"
 * - timer_stopped: "Alice stopped timer (2h 30m)"
 * - entry_logged: "Bob logged 1h 45m on Project Y"
 * - entry_approved: "Carol approved 3 entries for Dave"
 * - entry_rejected: "Carol rejected 1 entry for Dave"
 * - member_joined: "Eve joined the workspace"
 * - member_left: "Frank left the workspace"
 * - member_role_changed: "Role of Grace changed from member to admin"
 * - project_created: "Henry created project Z"
 * - project_member_added: "Ivy was added to Project W"
 * - goal_created: "Jack created a 40h goal"
 * - goal_completed: "Kate completed their 40h goal"
 *
 * USAGE:
 * ```tsx
 * import { ActivityEventDescription } from '@/components/activityFeed';
 *
 * <ActivityEventDescription
 *   eventType="entry_logged"
 *   actorName="John Doe"
 *   payload={{ project_name: "Website", duration_seconds: 3600 }}
 * />
 * ```
 */

import * as React from 'react';
import { View, StyleSheet, type ViewStyle, type StyleProp, type TextStyle } from 'react-native';

import { Text } from '@/components/ui';
import { useTheme, fontWeights } from '@/theme';
import {
  type ActivityEventType,
  type ActivityEventPayload,
  type TimerStartedPayload,
  type TimerStoppedPayload,
  type EntryLoggedPayload,
  type EntryApprovalPayload,
  type MemberPayload,
  type ProjectCreatedPayload,
  type ProjectMemberAddedPayload,
  type GoalPayload,
} from '@/schemas';

/**
 * ActivityEventDescription component props
 */
export interface ActivityEventDescriptionProps {
  /** Type of event */
  eventType: ActivityEventType;
  /** Actor's display name */
  actorName: string | null;
  /** Event-specific payload data */
  payload: ActivityEventPayload;
  /** Whether to show compact version */
  compact?: boolean;
  /** Additional styles */
  style?: StyleProp<ViewStyle>;
  /** Test ID for testing */
  testID?: string;
}

/**
 * Format duration from seconds to human readable string
 */
function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }

  return `${minutes}m`;
}

/**
 * Styled text component for bold/highlighted segments
 */
interface StyledSegment {
  text: string;
  bold?: boolean;
  highlight?: boolean;
  color?: string;
}

/**
 * Get description segments for timer_started event
 */
function getTimerStartedSegments(actorName: string, payload: TimerStartedPayload): StyledSegment[] {
  const segments: StyledSegment[] = [{ text: actorName, bold: true }, { text: ' started timer' }];

  if (payload.project_name) {
    segments.push({ text: ' on ' }, { text: payload.project_name, highlight: true });
  } else if (payload.category_name) {
    segments.push({ text: ' (' }, { text: payload.category_name }, { text: ')' });
  }

  return segments;
}

/**
 * Get description segments for timer_stopped event
 */
function getTimerStoppedSegments(actorName: string, payload: TimerStoppedPayload): StyledSegment[] {
  const duration = formatDuration(payload.duration_seconds);

  const segments: StyledSegment[] = [
    { text: actorName, bold: true },
    { text: ' stopped timer' },
    { text: ` (${duration})` },
  ];

  if (payload.project_name) {
    segments.push({ text: ' on ' }, { text: payload.project_name, highlight: true });
  }

  return segments;
}

/**
 * Get description segments for entry_logged event
 */
function getEntryLoggedSegments(actorName: string, payload: EntryLoggedPayload): StyledSegment[] {
  const duration = formatDuration(payload.duration_seconds);

  const segments: StyledSegment[] = [
    { text: actorName, bold: true },
    { text: ' logged ' },
    { text: duration, bold: true },
  ];

  if (payload.project_name) {
    segments.push({ text: ' on ' }, { text: payload.project_name, highlight: true });
  } else if (payload.category_name) {
    segments.push({ text: ' (' }, { text: payload.category_name }, { text: ')' });
  }

  return segments;
}

/**
 * Get description segments for entry_approved event
 */
function getEntryApprovedSegments(
  actorName: string,
  payload: EntryApprovalPayload
): StyledSegment[] {
  const count = payload.entry_count;
  const entryWord = count === 1 ? 'entry' : 'entries';
  const memberName = payload.member_name ?? 'a team member';

  return [
    { text: actorName, bold: true },
    { text: ` approved ${count} ${entryWord}` },
    { text: ' for ' },
    { text: memberName, bold: true },
  ];
}

/**
 * Get description segments for entry_rejected event
 */
function getEntryRejectedSegments(
  actorName: string,
  payload: EntryApprovalPayload
): StyledSegment[] {
  const count = payload.entry_count;
  const entryWord = count === 1 ? 'entry' : 'entries';
  const memberName = payload.member_name ?? 'a team member';

  return [
    { text: actorName, bold: true },
    { text: ` rejected ${count} ${entryWord}` },
    { text: ' for ' },
    { text: memberName, bold: true },
  ];
}

/**
 * Get description segments for member_joined event
 */
function getMemberJoinedSegments(_actorName: string, payload: MemberPayload): StyledSegment[] {
  const memberName = payload.user_name ?? payload.user_email;

  return [{ text: memberName, bold: true }, { text: ' joined the workspace' }];
}

/**
 * Get description segments for member_left event
 */
function getMemberLeftSegments(_actorName: string, payload: MemberPayload): StyledSegment[] {
  const memberName = payload.user_name ?? payload.user_email;

  return [{ text: memberName, bold: true }, { text: ' left the workspace' }];
}

/**
 * Get description segments for member_role_changed event
 */
function getMemberRoleChangedSegments(actorName: string, payload: MemberPayload): StyledSegment[] {
  const memberName = payload.user_name ?? payload.user_email;
  const oldRole = payload.old_role ?? 'member';
  const newRole = payload.new_role ?? 'member';

  return [
    { text: actorName, bold: true },
    { text: ' changed ' },
    { text: memberName, bold: true },
    { text: ` from ${oldRole} to ` },
    { text: newRole, highlight: true },
  ];
}

/**
 * Get description segments for project_created event
 */
function getProjectCreatedSegments(
  actorName: string,
  payload: ProjectCreatedPayload
): StyledSegment[] {
  return [
    { text: actorName, bold: true },
    { text: ' created project ' },
    { text: payload.project_name, highlight: true, color: payload.project_color },
  ];
}

/**
 * Get description segments for project_member_added event
 */
function getProjectMemberAddedSegments(
  _actorName: string,
  payload: ProjectMemberAddedPayload
): StyledSegment[] {
  const addedName = payload.added_user_name ?? 'A team member';

  return [
    { text: addedName, bold: true },
    { text: ' was added to ' },
    { text: payload.project_name, highlight: true },
  ];
}

/**
 * Get description segments for goal_created event
 */
function getGoalCreatedSegments(actorName: string, payload: GoalPayload): StyledSegment[] {
  const hours = payload.target_hours;

  const segments: StyledSegment[] = [
    { text: actorName, bold: true },
    { text: ` created a ${hours}h goal` },
  ];

  if (payload.category_name) {
    segments.push({ text: ' for ' }, { text: payload.category_name, highlight: true });
  }

  return segments;
}

/**
 * Get description segments for goal_completed event
 */
function getGoalCompletedSegments(actorName: string, payload: GoalPayload): StyledSegment[] {
  const hours = payload.target_hours;

  const segments: StyledSegment[] = [
    { text: actorName, bold: true },
    { text: ` completed their ${hours}h goal` },
  ];

  if (payload.category_name) {
    segments.push({ text: ' for ' }, { text: payload.category_name, highlight: true });
  }

  return segments;
}

/**
 * Get description segments based on event type
 */
function getDescriptionSegments(
  eventType: ActivityEventType,
  actorName: string,
  payload: ActivityEventPayload
): StyledSegment[] {
  switch (eventType) {
    case 'timer_started':
      return getTimerStartedSegments(actorName, payload as TimerStartedPayload);
    case 'timer_stopped':
      return getTimerStoppedSegments(actorName, payload as TimerStoppedPayload);
    case 'entry_logged':
      return getEntryLoggedSegments(actorName, payload as EntryLoggedPayload);
    case 'entry_approved':
      return getEntryApprovedSegments(actorName, payload as EntryApprovalPayload);
    case 'entry_rejected':
      return getEntryRejectedSegments(actorName, payload as EntryApprovalPayload);
    case 'member_joined':
      return getMemberJoinedSegments(actorName, payload as MemberPayload);
    case 'member_left':
      return getMemberLeftSegments(actorName, payload as MemberPayload);
    case 'member_role_changed':
      return getMemberRoleChangedSegments(actorName, payload as MemberPayload);
    case 'project_created':
      return getProjectCreatedSegments(actorName, payload as ProjectCreatedPayload);
    case 'project_member_added':
      return getProjectMemberAddedSegments(actorName, payload as ProjectMemberAddedPayload);
    case 'goal_created':
      return getGoalCreatedSegments(actorName, payload as GoalPayload);
    case 'goal_completed':
      return getGoalCompletedSegments(actorName, payload as GoalPayload);
    default: {
      // Fallback for unknown event types
      const eventTypeString = eventType as string;
      return [
        { text: actorName, bold: true },
        { text: ` performed ${eventTypeString.replace(/_/g, ' ')}` },
      ];
    }
  }
}

/**
 * ActivityEventDescription Component
 *
 * Renders formatted event description with styled text segments.
 */
export function ActivityEventDescription({
  eventType,
  actorName,
  payload,
  compact = false,
  style,
  testID,
}: ActivityEventDescriptionProps): React.ReactElement {
  const { colors } = useTheme();

  // Get the actor name or fallback
  const displayName = actorName ?? 'Someone';

  // Get description segments for this event
  const segments = React.useMemo(
    () => getDescriptionSegments(eventType, displayName, payload),
    [eventType, displayName, payload]
  );

  return (
    <View style={[styles.container, style]} testID={testID}>
      <Text variant={compact ? 'caption' : 'bodySmall'} numberOfLines={compact ? 1 : 2}>
        {segments.map((segment, index) => {
          const segmentStyle: TextStyle = {};

          if (segment.bold) {
            segmentStyle.fontWeight = fontWeights.semibold;
          }

          if (segment.highlight) {
            segmentStyle.color = segment.color ?? colors.primary;
          }

          return (
            <Text key={index} variant={compact ? 'caption' : 'bodySmall'} style={segmentStyle}>
              {segment.text}
            </Text>
          );
        })}
      </Text>
    </View>
  );
}

/**
 * Get a simple string description for accessibility
 */
export function getEventDescriptionText(
  eventType: ActivityEventType,
  actorName: string | null,
  payload: ActivityEventPayload
): string {
  const displayName = actorName ?? 'Someone';
  const segments = getDescriptionSegments(eventType, displayName, payload);
  return segments.map(s => s.text).join('');
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default ActivityEventDescription;
