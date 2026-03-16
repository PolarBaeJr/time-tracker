/**
 * Activity Feed Schema Tests
 *
 * Tests all activity feed Zod schemas with valid and invalid inputs.
 * Tests ActivityEventTypeEnum, ActivityEventSchema, payload schemas,
 * ActivityFeedPageSchema, ActivityFeedFilterSchema, etc.
 */

import {
  ActivityEventTypeEnum,
  ALL_ACTIVITY_EVENT_TYPES,
  ActivityEventPayloadSchema,
  TimerStartedPayloadSchema,
  TimerStoppedPayloadSchema,
  EntryLoggedPayloadSchema,
  EntryApprovalPayloadSchema,
  GoalPayloadSchema,
  MemberPayloadSchema,
  ProjectCreatedPayloadSchema,
  ProjectMemberAddedPayloadSchema,
  ActivityEventSchema,
  ActivityEventWithActorSchema,
  ActivityFeedPageSchema,
  ActivityFeedFilterSchema,
  ActivityEventRealtimePayloadSchema,
  EVENT_TYPE_NAMES,
  EVENT_TYPE_CATEGORIES,
} from '@/schemas/activityFeed';

describe('Activity Feed Schemas', () => {
  // ============================================================================
  // ActivityEventTypeEnum Tests
  // ============================================================================

  describe('ActivityEventTypeEnum', () => {
    it('should accept all valid event type values', () => {
      expect(ActivityEventTypeEnum.safeParse('timer_started').success).toBe(true);
      expect(ActivityEventTypeEnum.safeParse('timer_stopped').success).toBe(true);
      expect(ActivityEventTypeEnum.safeParse('entry_logged').success).toBe(true);
      expect(ActivityEventTypeEnum.safeParse('goal_created').success).toBe(true);
      expect(ActivityEventTypeEnum.safeParse('goal_completed').success).toBe(true);
      expect(ActivityEventTypeEnum.safeParse('entry_approved').success).toBe(true);
      expect(ActivityEventTypeEnum.safeParse('entry_rejected').success).toBe(true);
      expect(ActivityEventTypeEnum.safeParse('member_joined').success).toBe(true);
      expect(ActivityEventTypeEnum.safeParse('member_left').success).toBe(true);
      expect(ActivityEventTypeEnum.safeParse('member_role_changed').success).toBe(true);
      expect(ActivityEventTypeEnum.safeParse('project_created').success).toBe(true);
      expect(ActivityEventTypeEnum.safeParse('project_member_added').success).toBe(true);
    });

    it('should reject invalid event type values', () => {
      expect(ActivityEventTypeEnum.safeParse('invalid_event').success).toBe(false);
      expect(ActivityEventTypeEnum.safeParse('timer_paused').success).toBe(false);
      expect(ActivityEventTypeEnum.safeParse('').success).toBe(false);
      expect(ActivityEventTypeEnum.safeParse(null).success).toBe(false);
    });

    it('should have ALL_ACTIVITY_EVENT_TYPES matching enum options', () => {
      expect(ALL_ACTIVITY_EVENT_TYPES).toEqual(ActivityEventTypeEnum.options);
      expect(ALL_ACTIVITY_EVENT_TYPES.length).toBe(12);
    });
  });

  // ============================================================================
  // Constants Tests
  // ============================================================================

  describe('Constants', () => {
    it('should have human-readable names for all event types', () => {
      expect(EVENT_TYPE_NAMES.timer_started).toBe('Timer Started');
      expect(EVENT_TYPE_NAMES.timer_stopped).toBe('Timer Stopped');
      expect(EVENT_TYPE_NAMES.entry_logged).toBe('Time Logged');
      expect(EVENT_TYPE_NAMES.goal_created).toBe('Goal Created');
      expect(EVENT_TYPE_NAMES.goal_completed).toBe('Goal Completed');
      expect(EVENT_TYPE_NAMES.entry_approved).toBe('Entry Approved');
      expect(EVENT_TYPE_NAMES.entry_rejected).toBe('Entry Rejected');
      expect(EVENT_TYPE_NAMES.member_joined).toBe('Member Joined');
      expect(EVENT_TYPE_NAMES.member_left).toBe('Member Left');
      expect(EVENT_TYPE_NAMES.member_role_changed).toBe('Role Changed');
      expect(EVENT_TYPE_NAMES.project_created).toBe('Project Created');
      expect(EVENT_TYPE_NAMES.project_member_added).toBe('Added to Project');
    });

    it('should have correct event type categories', () => {
      expect(EVENT_TYPE_CATEGORIES.timer).toEqual(['timer_started', 'timer_stopped']);
      expect(EVENT_TYPE_CATEGORIES.entries).toEqual([
        'entry_logged',
        'entry_approved',
        'entry_rejected',
      ]);
      expect(EVENT_TYPE_CATEGORIES.goals).toEqual(['goal_created', 'goal_completed']);
      expect(EVENT_TYPE_CATEGORIES.members).toEqual([
        'member_joined',
        'member_left',
        'member_role_changed',
      ]);
      expect(EVENT_TYPE_CATEGORIES.projects).toEqual(['project_created', 'project_member_added']);
    });
  });

  // ============================================================================
  // Payload Schema Tests
  // ============================================================================

  describe('ActivityEventPayloadSchema', () => {
    it('should accept any record of string keys', () => {
      const result = ActivityEventPayloadSchema.safeParse({
        key1: 'value1',
        key2: 123,
        key3: true,
        key4: { nested: 'object' },
      });
      expect(result.success).toBe(true);
    });

    it('should accept empty object', () => {
      const result = ActivityEventPayloadSchema.safeParse({});
      expect(result.success).toBe(true);
    });
  });

  describe('TimerStartedPayloadSchema', () => {
    it('should accept valid timer started payload', () => {
      const result = TimerStartedPayloadSchema.safeParse({
        project_id: '123e4567-e89b-12d3-a456-426614174000',
        project_name: 'Website Redesign',
        category_id: '123e4567-e89b-12d3-a456-426614174001',
        category_name: 'Development',
      });
      expect(result.success).toBe(true);
    });

    it('should accept empty payload (all fields optional)', () => {
      const result = TimerStartedPayloadSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('should require valid UUID for project_id when provided', () => {
      const result = TimerStartedPayloadSchema.safeParse({ project_id: 'invalid' });
      expect(result.success).toBe(false);
    });
  });

  describe('TimerStoppedPayloadSchema', () => {
    it('should accept valid timer stopped payload', () => {
      const result = TimerStoppedPayloadSchema.safeParse({
        project_id: '123e4567-e89b-12d3-a456-426614174000',
        project_name: 'Website Redesign',
        duration_seconds: 3600,
      });
      expect(result.success).toBe(true);
    });

    it('should require duration_seconds', () => {
      const result = TimerStoppedPayloadSchema.safeParse({
        project_name: 'Website Redesign',
      });
      expect(result.success).toBe(false);
    });

    it('should require non-negative duration_seconds', () => {
      expect(TimerStoppedPayloadSchema.safeParse({ duration_seconds: 0 }).success).toBe(true);
      expect(TimerStoppedPayloadSchema.safeParse({ duration_seconds: -1 }).success).toBe(false);
    });
  });

  describe('EntryLoggedPayloadSchema', () => {
    it('should accept valid entry logged payload', () => {
      const result = EntryLoggedPayloadSchema.safeParse({
        entry_id: '123e4567-e89b-12d3-a456-426614174000',
        project_id: '123e4567-e89b-12d3-a456-426614174001',
        project_name: 'Website Redesign',
        category_id: '123e4567-e89b-12d3-a456-426614174002',
        category_name: 'Development',
        duration_seconds: 1800,
      });
      expect(result.success).toBe(true);
    });

    it('should require entry_id and duration_seconds', () => {
      const result = EntryLoggedPayloadSchema.safeParse({
        project_name: 'Test',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('EntryApprovalPayloadSchema', () => {
    it('should accept valid entry approval payload', () => {
      const result = EntryApprovalPayloadSchema.safeParse({
        member_user_id: '123e4567-e89b-12d3-a456-426614174000',
        member_name: 'John Doe',
        entry_count: 5,
        date_range_start: '2024-03-01T00:00:00.000Z',
        date_range_end: '2024-03-07T23:59:59.999Z',
      });
      expect(result.success).toBe(true);
    });

    it('should allow null member_name', () => {
      const result = EntryApprovalPayloadSchema.safeParse({
        member_user_id: '123e4567-e89b-12d3-a456-426614174000',
        member_name: null,
        entry_count: 3,
      });
      expect(result.success).toBe(true);
    });

    it('should require positive entry_count', () => {
      expect(
        EntryApprovalPayloadSchema.safeParse({
          member_user_id: '123e4567-e89b-12d3-a456-426614174000',
          member_name: 'Test',
          entry_count: 0,
        }).success
      ).toBe(false);
    });

    it('should allow optional rejection_reason', () => {
      const result = EntryApprovalPayloadSchema.safeParse({
        member_user_id: '123e4567-e89b-12d3-a456-426614174000',
        member_name: 'Test',
        entry_count: 1,
        rejection_reason: 'Missing details',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('GoalPayloadSchema', () => {
    it('should accept valid goal payload', () => {
      const result = GoalPayloadSchema.safeParse({
        goal_id: '123e4567-e89b-12d3-a456-426614174000',
        goal_type: 'overall',
        target_hours: 40,
      });
      expect(result.success).toBe(true);
    });

    it('should validate goal_type enum', () => {
      expect(
        GoalPayloadSchema.safeParse({
          goal_id: '123e4567-e89b-12d3-a456-426614174000',
          goal_type: 'overall',
          target_hours: 40,
        }).success
      ).toBe(true);
      expect(
        GoalPayloadSchema.safeParse({
          goal_id: '123e4567-e89b-12d3-a456-426614174000',
          goal_type: 'category',
          target_hours: 20,
          category_id: '123e4567-e89b-12d3-a456-426614174001',
        }).success
      ).toBe(true);
      expect(
        GoalPayloadSchema.safeParse({
          goal_id: '123e4567-e89b-12d3-a456-426614174000',
          goal_type: 'type',
          target_hours: 10,
        }).success
      ).toBe(true);
      expect(
        GoalPayloadSchema.safeParse({
          goal_id: '123e4567-e89b-12d3-a456-426614174000',
          goal_type: 'invalid',
          target_hours: 10,
        }).success
      ).toBe(false);
    });

    it('should require non-negative target_hours', () => {
      expect(
        GoalPayloadSchema.safeParse({
          goal_id: '123e4567-e89b-12d3-a456-426614174000',
          goal_type: 'overall',
          target_hours: -5,
        }).success
      ).toBe(false);
    });
  });

  describe('MemberPayloadSchema', () => {
    it('should accept valid member payload', () => {
      const result = MemberPayloadSchema.safeParse({
        user_id: '123e4567-e89b-12d3-a456-426614174000',
        user_name: 'John Doe',
        user_email: 'john@example.com',
      });
      expect(result.success).toBe(true);
    });

    it('should allow null user_name', () => {
      const result = MemberPayloadSchema.safeParse({
        user_id: '123e4567-e89b-12d3-a456-426614174000',
        user_name: null,
        user_email: 'john@example.com',
      });
      expect(result.success).toBe(true);
    });

    it('should allow role change fields', () => {
      const result = MemberPayloadSchema.safeParse({
        user_id: '123e4567-e89b-12d3-a456-426614174000',
        user_name: 'John Doe',
        user_email: 'john@example.com',
        old_role: 'member',
        new_role: 'admin',
      });
      expect(result.success).toBe(true);
    });

    it('should validate role enum values', () => {
      expect(
        MemberPayloadSchema.safeParse({
          user_id: '123e4567-e89b-12d3-a456-426614174000',
          user_name: 'Test',
          user_email: 'test@example.com',
          old_role: 'invalid',
        }).success
      ).toBe(false);
    });
  });

  describe('ProjectCreatedPayloadSchema', () => {
    it('should accept valid project created payload', () => {
      const result = ProjectCreatedPayloadSchema.safeParse({
        project_id: '123e4567-e89b-12d3-a456-426614174000',
        project_name: 'New Project',
        project_color: '#6366F1',
      });
      expect(result.success).toBe(true);
    });

    it('should require all fields', () => {
      const result = ProjectCreatedPayloadSchema.safeParse({
        project_id: '123e4567-e89b-12d3-a456-426614174000',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('ProjectMemberAddedPayloadSchema', () => {
    it('should accept valid project member added payload', () => {
      const result = ProjectMemberAddedPayloadSchema.safeParse({
        project_id: '123e4567-e89b-12d3-a456-426614174000',
        project_name: 'Website Redesign',
        added_user_id: '123e4567-e89b-12d3-a456-426614174001',
        added_user_name: 'Jane Doe',
        role: 'member',
      });
      expect(result.success).toBe(true);
    });

    it('should allow null added_user_name', () => {
      const result = ProjectMemberAddedPayloadSchema.safeParse({
        project_id: '123e4567-e89b-12d3-a456-426614174000',
        project_name: 'Website Redesign',
        added_user_id: '123e4567-e89b-12d3-a456-426614174001',
        added_user_name: null,
        role: 'admin',
      });
      expect(result.success).toBe(true);
    });

    it('should validate role enum', () => {
      expect(
        ProjectMemberAddedPayloadSchema.safeParse({
          project_id: '123e4567-e89b-12d3-a456-426614174000',
          project_name: 'Test',
          added_user_id: '123e4567-e89b-12d3-a456-426614174001',
          added_user_name: 'Test User',
          role: 'invalid',
        }).success
      ).toBe(false);
    });
  });

  // ============================================================================
  // ActivityEventSchema Tests
  // ============================================================================

  describe('ActivityEventSchema', () => {
    const validEvent = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      workspace_id: '123e4567-e89b-12d3-a456-426614174001',
      actor_user_id: '123e4567-e89b-12d3-a456-426614174002',
      event_type: 'timer_started',
      payload: { project_name: 'Website Redesign' },
      created_at: '2024-03-01T10:00:00.000Z',
    };

    it('should accept valid event data', () => {
      const result = ActivityEventSchema.safeParse(validEvent);
      expect(result.success).toBe(true);
    });

    it('should require valid UUIDs', () => {
      expect(ActivityEventSchema.safeParse({ ...validEvent, id: 'invalid' }).success).toBe(false);
      expect(
        ActivityEventSchema.safeParse({ ...validEvent, workspace_id: 'invalid' }).success
      ).toBe(false);
      expect(
        ActivityEventSchema.safeParse({ ...validEvent, actor_user_id: 'invalid' }).success
      ).toBe(false);
    });

    it('should validate event_type enum', () => {
      expect(
        ActivityEventSchema.safeParse({ ...validEvent, event_type: 'invalid_type' }).success
      ).toBe(false);
    });

    it('should default payload to empty object', () => {
      const { payload, ...withoutPayload } = validEvent;
      const result = ActivityEventSchema.safeParse(withoutPayload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.payload).toEqual({});
      }
    });

    it('should require valid datetime for created_at', () => {
      const result = ActivityEventSchema.safeParse({ ...validEvent, created_at: 'invalid' });
      expect(result.success).toBe(false);
    });
  });

  // ============================================================================
  // ActivityEventWithActorSchema Tests
  // ============================================================================

  describe('ActivityEventWithActorSchema', () => {
    const validEventWithActor = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      workspace_id: '123e4567-e89b-12d3-a456-426614174001',
      actor_user_id: '123e4567-e89b-12d3-a456-426614174002',
      event_type: 'member_joined',
      payload: {},
      created_at: '2024-03-01T10:00:00.000Z',
      actor: {
        id: '123e4567-e89b-12d3-a456-426614174002',
        email: 'actor@example.com',
        name: 'John Actor',
      },
    };

    it('should accept valid event with actor', () => {
      const result = ActivityEventWithActorSchema.safeParse(validEventWithActor);
      expect(result.success).toBe(true);
    });

    it('should allow null name in actor', () => {
      const result = ActivityEventWithActorSchema.safeParse({
        ...validEventWithActor,
        actor: { ...validEventWithActor.actor, name: null },
      });
      expect(result.success).toBe(true);
    });

    it('should require valid email in actor', () => {
      const result = ActivityEventWithActorSchema.safeParse({
        ...validEventWithActor,
        actor: { ...validEventWithActor.actor, email: 'invalid' },
      });
      expect(result.success).toBe(false);
    });

    it('should require actor object', () => {
      const { actor, ...withoutActor } = validEventWithActor;
      const result = ActivityEventWithActorSchema.safeParse(withoutActor);
      expect(result.success).toBe(false);
    });
  });

  // ============================================================================
  // ActivityFeedPageSchema Tests
  // ============================================================================

  describe('ActivityFeedPageSchema', () => {
    const validPage = {
      events: [
        {
          id: '123e4567-e89b-12d3-a456-426614174000',
          workspace_id: '123e4567-e89b-12d3-a456-426614174001',
          actor_user_id: '123e4567-e89b-12d3-a456-426614174002',
          event_type: 'timer_started',
          payload: {},
          created_at: '2024-03-01T10:00:00.000Z',
          actor: {
            id: '123e4567-e89b-12d3-a456-426614174002',
            email: 'user@example.com',
            name: 'Test User',
          },
        },
      ],
      next_cursor: 'eyJjcmVhdGVkX2F0IjoiMjAyNC0wMy0wMVQxMDowMDowMC4wMDBaIn0=',
      has_more: true,
    };

    it('should accept valid page data', () => {
      const result = ActivityFeedPageSchema.safeParse(validPage);
      expect(result.success).toBe(true);
    });

    it('should accept empty events array', () => {
      const result = ActivityFeedPageSchema.safeParse({
        events: [],
        next_cursor: null,
        has_more: false,
      });
      expect(result.success).toBe(true);
    });

    it('should allow null next_cursor', () => {
      const result = ActivityFeedPageSchema.safeParse({
        ...validPage,
        next_cursor: null,
      });
      expect(result.success).toBe(true);
    });

    it('should require has_more boolean', () => {
      const { has_more, ...withoutHasMore } = validPage;
      const result = ActivityFeedPageSchema.safeParse(withoutHasMore);
      expect(result.success).toBe(false);
    });
  });

  // ============================================================================
  // ActivityFeedFilterSchema Tests
  // ============================================================================

  describe('ActivityFeedFilterSchema', () => {
    it('should accept valid filter with all fields', () => {
      const result = ActivityFeedFilterSchema.safeParse({
        workspaceId: '123e4567-e89b-12d3-a456-426614174000',
        eventTypes: ['timer_started', 'timer_stopped'],
        actorId: '123e4567-e89b-12d3-a456-426614174001',
        since: '2024-03-01T00:00:00.000Z',
        until: '2024-03-31T23:59:59.999Z',
        limit: 50,
        cursor: 'some-cursor-string',
      });
      expect(result.success).toBe(true);
    });

    it('should accept empty object (all optional)', () => {
      const result = ActivityFeedFilterSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('should provide default limit of 20', () => {
      const result = ActivityFeedFilterSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(20);
      }
    });

    it('should validate limit max (100)', () => {
      expect(ActivityFeedFilterSchema.safeParse({ limit: 100 }).success).toBe(true);
      expect(ActivityFeedFilterSchema.safeParse({ limit: 101 }).success).toBe(false);
    });

    it('should validate limit min (positive)', () => {
      expect(ActivityFeedFilterSchema.safeParse({ limit: 1 }).success).toBe(true);
      expect(ActivityFeedFilterSchema.safeParse({ limit: 0 }).success).toBe(false);
      expect(ActivityFeedFilterSchema.safeParse({ limit: -1 }).success).toBe(false);
    });

    it('should validate eventTypes array', () => {
      expect(
        ActivityFeedFilterSchema.safeParse({ eventTypes: ['timer_started', 'entry_logged'] })
          .success
      ).toBe(true);
      expect(ActivityFeedFilterSchema.safeParse({ eventTypes: ['invalid_type'] }).success).toBe(
        false
      );
    });
  });

  // ============================================================================
  // ActivityEventRealtimePayloadSchema Tests
  // ============================================================================

  describe('ActivityEventRealtimePayloadSchema', () => {
    const validRealtimePayload = {
      eventType: 'INSERT',
      new: {
        id: '123e4567-e89b-12d3-a456-426614174000',
        workspace_id: '123e4567-e89b-12d3-a456-426614174001',
        actor_user_id: '123e4567-e89b-12d3-a456-426614174002',
        event_type: 'timer_started',
        payload: {},
        created_at: '2024-03-01T10:00:00.000Z',
      },
      schema: 'public',
      table: 'activity_feed',
    };

    it('should accept valid realtime payload', () => {
      const result = ActivityEventRealtimePayloadSchema.safeParse(validRealtimePayload);
      expect(result.success).toBe(true);
    });

    it('should only accept INSERT eventType', () => {
      expect(
        ActivityEventRealtimePayloadSchema.safeParse({
          ...validRealtimePayload,
          eventType: 'UPDATE',
        }).success
      ).toBe(false);
      expect(
        ActivityEventRealtimePayloadSchema.safeParse({
          ...validRealtimePayload,
          eventType: 'DELETE',
        }).success
      ).toBe(false);
    });

    it('should only accept public schema', () => {
      expect(
        ActivityEventRealtimePayloadSchema.safeParse({
          ...validRealtimePayload,
          schema: 'private',
        }).success
      ).toBe(false);
    });

    it('should only accept activity_feed table', () => {
      expect(
        ActivityEventRealtimePayloadSchema.safeParse({
          ...validRealtimePayload,
          table: 'other_table',
        }).success
      ).toBe(false);
    });
  });
});
