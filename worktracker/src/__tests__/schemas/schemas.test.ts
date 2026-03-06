/**
 * Zod Schema Tests
 *
 * Tests all Zod schemas with valid and invalid inputs.
 * Specifically verifies that Create/Update schemas reject server-managed fields.
 */

import { z } from 'zod';
import {
  // User schemas
  UserSchema,
  UpdateUserSchema,
  // Category schemas
  CategorySchema,
  CreateCategorySchema,
  UpdateCategorySchema,
  CategoryIdSchema,
  // Time entry schemas
  TimeEntrySchema,
  CreateTimeEntrySchema,
  UpdateTimeEntrySchema,
  TimeEntryFiltersSchema,
  // Timer schemas
  ActiveTimerSchema,
  StartTimerSchema,
  StopTimerSchema,
  QueuedActionSchema,
  // Goal schemas
  MonthlyGoalSchema,
  CreateGoalSchema,
  UpdateGoalSchema,
  SetOverallGoalSchema,
  SetCategoryGoalSchema,
} from '@/schemas';

describe('Zod Schemas', () => {
  // ============================================================================
  // User Schema Tests
  // ============================================================================

  describe('UserSchema', () => {
    const validUser = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      email: 'test@example.com',
      name: 'Test User',
      timezone: 'America/New_York',
      week_start_day: 1,
      created_at: '2024-03-01T00:00:00.000Z',
      updated_at: '2024-03-01T00:00:00.000Z',
    };

    it('should accept valid user data', () => {
      const result = UserSchema.safeParse(validUser);
      expect(result.success).toBe(true);
    });

    it('should require valid UUID for id', () => {
      const result = UserSchema.safeParse({ ...validUser, id: 'invalid' });
      expect(result.success).toBe(false);
    });

    it('should require valid email', () => {
      const result = UserSchema.safeParse({ ...validUser, email: 'invalid' });
      expect(result.success).toBe(false);
    });

    it('should allow null name', () => {
      const result = UserSchema.safeParse({ ...validUser, name: null });
      expect(result.success).toBe(true);
    });

    it('should validate week_start_day range (0-6)', () => {
      expect(UserSchema.safeParse({ ...validUser, week_start_day: -1 }).success).toBe(false);
      expect(UserSchema.safeParse({ ...validUser, week_start_day: 7 }).success).toBe(false);
      expect(UserSchema.safeParse({ ...validUser, week_start_day: 0 }).success).toBe(true);
      expect(UserSchema.safeParse({ ...validUser, week_start_day: 6 }).success).toBe(true);
    });
  });

  describe('UpdateUserSchema', () => {
    it('should accept valid update data', () => {
      const result = UpdateUserSchema.safeParse({
        name: 'New Name',
        timezone: 'UTC',
        week_start_day: 0,
      });
      expect(result.success).toBe(true);
    });

    it('should REJECT server-managed fields', () => {
      // UpdateUserSchema should NOT include id, email, created_at, updated_at
      const schema = UpdateUserSchema.shape;

      expect('id' in schema).toBe(false);
      expect('email' in schema).toBe(false);
      expect('created_at' in schema).toBe(false);
      expect('updated_at' in schema).toBe(false);
    });

    it('should allow partial updates', () => {
      const result = UpdateUserSchema.safeParse({ name: 'Only Name' });
      expect(result.success).toBe(true);
    });

    it('should validate name length (1-100)', () => {
      expect(UpdateUserSchema.safeParse({ name: '' }).success).toBe(false);
      expect(UpdateUserSchema.safeParse({ name: 'a'.repeat(101) }).success).toBe(false);
      expect(UpdateUserSchema.safeParse({ name: 'Valid Name' }).success).toBe(true);
    });
  });

  // ============================================================================
  // Category Schema Tests
  // ============================================================================

  describe('CategorySchema', () => {
    const validCategory = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      user_id: '123e4567-e89b-12d3-a456-426614174001',
      name: 'Work',
      color: '#6366F1',
      type: 'work',
      created_at: '2024-03-01T00:00:00.000Z',
    };

    it('should accept valid category data', () => {
      const result = CategorySchema.safeParse(validCategory);
      expect(result.success).toBe(true);
    });

    it('should validate hex color format', () => {
      expect(CategorySchema.safeParse({ ...validCategory, color: 'invalid' }).success).toBe(false);
      expect(CategorySchema.safeParse({ ...validCategory, color: '#FFF' }).success).toBe(false);
      expect(CategorySchema.safeParse({ ...validCategory, color: '#FFFFFF' }).success).toBe(true);
      expect(CategorySchema.safeParse({ ...validCategory, color: '#ffffff' }).success).toBe(true);
    });

    it('should validate name length (1-100)', () => {
      expect(CategorySchema.safeParse({ ...validCategory, name: '' }).success).toBe(false);
      expect(CategorySchema.safeParse({ ...validCategory, name: 'a'.repeat(101) }).success).toBe(
        false
      );
    });

    it('should validate type length (1-50)', () => {
      expect(CategorySchema.safeParse({ ...validCategory, type: '' }).success).toBe(false);
      expect(CategorySchema.safeParse({ ...validCategory, type: 'a'.repeat(51) }).success).toBe(
        false
      );
    });
  });

  describe('CreateCategorySchema', () => {
    const validCreate = {
      name: 'Work',
      color: '#6366F1',
      type: 'work',
    };

    it('should accept valid create data', () => {
      const result = CreateCategorySchema.safeParse(validCreate);
      expect(result.success).toBe(true);
    });

    it('should REJECT server-managed fields', () => {
      const schema = CreateCategorySchema.shape;

      // These fields should NOT be in CreateCategorySchema
      expect('id' in schema).toBe(false);
      expect('user_id' in schema).toBe(false);
      expect('created_at' in schema).toBe(false);
    });

    it('should require all fields (name, color, type)', () => {
      expect(CreateCategorySchema.safeParse({ color: '#6366F1', type: 'work' }).success).toBe(
        false
      );
      expect(CreateCategorySchema.safeParse({ name: 'Work', type: 'work' }).success).toBe(false);
      expect(CreateCategorySchema.safeParse({ name: 'Work', color: '#6366F1' }).success).toBe(
        false
      );
    });
  });

  describe('UpdateCategorySchema', () => {
    it('should accept partial updates', () => {
      expect(UpdateCategorySchema.safeParse({ name: 'New Name' }).success).toBe(true);
      expect(UpdateCategorySchema.safeParse({ color: '#FF0000' }).success).toBe(true);
      expect(UpdateCategorySchema.safeParse({ type: 'hobby' }).success).toBe(true);
    });

    it('should REJECT server-managed fields', () => {
      const schema = UpdateCategorySchema.shape;

      expect('id' in schema).toBe(false);
      expect('user_id' in schema).toBe(false);
      expect('created_at' in schema).toBe(false);
    });

    it('should accept empty object (no changes)', () => {
      const result = UpdateCategorySchema.safeParse({});
      expect(result.success).toBe(true);
    });
  });

  describe('CategoryIdSchema', () => {
    it('should accept valid UUID', () => {
      const result = CategoryIdSchema.safeParse('123e4567-e89b-12d3-a456-426614174000');
      expect(result.success).toBe(true);
    });

    it('should accept null', () => {
      const result = CategoryIdSchema.safeParse(null);
      expect(result.success).toBe(true);
    });

    it('should accept undefined', () => {
      const result = CategoryIdSchema.safeParse(undefined);
      expect(result.success).toBe(true);
    });

    it('should reject invalid UUID', () => {
      const result = CategoryIdSchema.safeParse('invalid-uuid');
      expect(result.success).toBe(false);
    });
  });

  // ============================================================================
  // Time Entry Schema Tests
  // ============================================================================

  describe('TimeEntrySchema', () => {
    const validEntry = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      user_id: '123e4567-e89b-12d3-a456-426614174001',
      category_id: '123e4567-e89b-12d3-a456-426614174002',
      start_at: '2024-03-01T10:00:00.000Z',
      end_at: '2024-03-01T11:00:00.000Z',
      duration_seconds: 3600,
      notes: 'Worked on feature',
      created_at: '2024-03-01T11:00:00.000Z',
      updated_at: '2024-03-01T11:00:00.000Z',
    };

    it('should accept valid entry data', () => {
      const result = TimeEntrySchema.safeParse(validEntry);
      expect(result.success).toBe(true);
    });

    it('should allow null category_id', () => {
      const result = TimeEntrySchema.safeParse({ ...validEntry, category_id: null });
      expect(result.success).toBe(true);
    });

    it('should allow null notes', () => {
      const result = TimeEntrySchema.safeParse({ ...validEntry, notes: null });
      expect(result.success).toBe(true);
    });

    it('should validate notes max length (1000)', () => {
      const result = TimeEntrySchema.safeParse({ ...validEntry, notes: 'a'.repeat(1001) });
      expect(result.success).toBe(false);
    });

    it('should require non-negative duration_seconds', () => {
      expect(TimeEntrySchema.safeParse({ ...validEntry, duration_seconds: -1 }).success).toBe(
        false
      );
      expect(TimeEntrySchema.safeParse({ ...validEntry, duration_seconds: 0 }).success).toBe(true);
    });
  });

  describe('CreateTimeEntrySchema', () => {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 3600000);

    const validCreate = {
      category_id: '123e4567-e89b-12d3-a456-426614174000',
      start_at: oneHourAgo.toISOString(),
      end_at: now.toISOString(),
      duration_seconds: 3600,
      notes: 'Test entry',
    };

    it('should accept valid create data', () => {
      const result = CreateTimeEntrySchema.safeParse(validCreate);
      expect(result.success).toBe(true);
    });

    it('should REJECT server-managed fields', () => {
      const schemaKeys = Object.keys(
        (CreateTimeEntrySchema as z.ZodEffects<z.ZodObject<z.ZodRawShape>>)._def.schema.shape
      );

      // These fields should NOT be in CreateTimeEntrySchema
      expect(schemaKeys.includes('id')).toBe(false);
      expect(schemaKeys.includes('user_id')).toBe(false);
      expect(schemaKeys.includes('created_at')).toBe(false);
      expect(schemaKeys.includes('updated_at')).toBe(false);
    });

    it('should require duration_seconds > 0', () => {
      const result = CreateTimeEntrySchema.safeParse({
        ...validCreate,
        duration_seconds: 0,
      });
      expect(result.success).toBe(false);
    });

    it('should validate end_at > start_at when both provided', () => {
      const result = CreateTimeEntrySchema.safeParse({
        ...validCreate,
        start_at: now.toISOString(),
        end_at: oneHourAgo.toISOString(), // end before start
      });
      expect(result.success).toBe(false);
    });

    it('should reject future start_at', () => {
      const future = new Date(Date.now() + 60000).toISOString();
      const result = CreateTimeEntrySchema.safeParse({
        ...validCreate,
        start_at: future,
        end_at: null,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('UpdateTimeEntrySchema', () => {
    it('should accept partial updates', () => {
      expect(UpdateTimeEntrySchema.safeParse({ notes: 'Updated' }).success).toBe(true);
      expect(UpdateTimeEntrySchema.safeParse({ duration_seconds: 7200 }).success).toBe(true);
    });

    it('should REJECT server-managed fields', () => {
      const schemaKeys = Object.keys(
        (UpdateTimeEntrySchema as z.ZodEffects<z.ZodObject<z.ZodRawShape>>)._def.schema.shape
      );

      expect(schemaKeys.includes('id')).toBe(false);
      expect(schemaKeys.includes('user_id')).toBe(false);
      expect(schemaKeys.includes('created_at')).toBe(false);
      expect(schemaKeys.includes('updated_at')).toBe(false);
    });

    it('should validate time ordering when both provided', () => {
      const result = UpdateTimeEntrySchema.safeParse({
        start_at: '2024-03-01T12:00:00.000Z',
        end_at: '2024-03-01T10:00:00.000Z', // end before start
      });
      expect(result.success).toBe(false);
    });
  });

  describe('TimeEntryFiltersSchema', () => {
    it('should accept all filter options', () => {
      const result = TimeEntryFiltersSchema.safeParse({
        dateStart: '2024-03-01T00:00:00.000Z',
        dateEnd: '2024-03-31T23:59:59.000Z',
        categoryId: '123e4567-e89b-12d3-a456-426614174000',
        searchNotes: 'search term',
        minDuration: 60,
        maxDuration: 3600,
      });
      expect(result.success).toBe(true);
    });

    it('should accept empty filters', () => {
      const result = TimeEntryFiltersSchema.safeParse({});
      expect(result.success).toBe(true);
    });
  });

  // ============================================================================
  // Timer Schema Tests
  // ============================================================================

  describe('ActiveTimerSchema', () => {
    const validTimer = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      user_id: '123e4567-e89b-12d3-a456-426614174001',
      category_id: '123e4567-e89b-12d3-a456-426614174002',
      started_at: '2024-03-01T10:00:00.000Z',
      running: true,
    };

    it('should accept valid timer data', () => {
      const result = ActiveTimerSchema.safeParse(validTimer);
      expect(result.success).toBe(true);
    });

    it('should allow null category_id', () => {
      const result = ActiveTimerSchema.safeParse({ ...validTimer, category_id: null });
      expect(result.success).toBe(true);
    });

    it('should require running boolean', () => {
      const result = ActiveTimerSchema.safeParse({ ...validTimer, running: undefined });
      expect(result.success).toBe(false);
    });
  });

  describe('StartTimerSchema', () => {
    it('should accept valid start data', () => {
      const result = StartTimerSchema.safeParse({
        category_id: '123e4567-e89b-12d3-a456-426614174000',
      });
      expect(result.success).toBe(true);
    });

    it('should REJECT started_at (server sets this)', () => {
      const schema = StartTimerSchema.shape;
      expect('started_at' in schema).toBe(false);
    });

    it('should REJECT server-managed fields', () => {
      const schema = StartTimerSchema.shape;

      expect('id' in schema).toBe(false);
      expect('user_id' in schema).toBe(false);
    });

    it('should accept null category_id', () => {
      const result = StartTimerSchema.safeParse({ category_id: null });
      expect(result.success).toBe(true);
    });

    it('should accept undefined category_id', () => {
      const result = StartTimerSchema.safeParse({});
      expect(result.success).toBe(true);
    });
  });

  describe('StopTimerSchema', () => {
    it('should accept valid stop data', () => {
      const result = StopTimerSchema.safeParse({ notes: 'Completed task' });
      expect(result.success).toBe(true);
    });

    it('should accept null notes', () => {
      const result = StopTimerSchema.safeParse({ notes: null });
      expect(result.success).toBe(true);
    });

    it('should accept empty object', () => {
      const result = StopTimerSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('should validate notes max length (1000)', () => {
      const result = StopTimerSchema.safeParse({ notes: 'a'.repeat(1001) });
      expect(result.success).toBe(false);
    });
  });

  describe('QueuedActionSchema', () => {
    const validAction = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      action: 'create_entry' as const,
      payload: { notes: 'test' },
      timestamp: '2024-03-01T10:00:00.000Z',
      retryCount: 0,
    };

    it('should accept valid action data', () => {
      const result = QueuedActionSchema.safeParse(validAction);
      expect(result.success).toBe(true);
    });

    it('should validate action enum', () => {
      expect(
        QueuedActionSchema.safeParse({ ...validAction, action: 'create_entry' }).success
      ).toBe(true);
      expect(
        QueuedActionSchema.safeParse({ ...validAction, action: 'update_entry' }).success
      ).toBe(true);
      expect(
        QueuedActionSchema.safeParse({ ...validAction, action: 'delete_entry' }).success
      ).toBe(true);
      expect(
        QueuedActionSchema.safeParse({ ...validAction, action: 'invalid_action' }).success
      ).toBe(false);
    });

    it('should require non-negative retryCount', () => {
      expect(QueuedActionSchema.safeParse({ ...validAction, retryCount: -1 }).success).toBe(false);
      expect(QueuedActionSchema.safeParse({ ...validAction, retryCount: 0 }).success).toBe(true);
    });
  });

  // ============================================================================
  // Goal Schema Tests
  // ============================================================================

  describe('MonthlyGoalSchema', () => {
    const validGoal = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      user_id: '123e4567-e89b-12d3-a456-426614174001',
      month: '2024-03-01',
      category_id: '123e4567-e89b-12d3-a456-426614174002',
      target_hours: 40,
    };

    it('should accept valid goal data', () => {
      const result = MonthlyGoalSchema.safeParse(validGoal);
      expect(result.success).toBe(true);
    });

    it('should allow null category_id (overall goal)', () => {
      const result = MonthlyGoalSchema.safeParse({ ...validGoal, category_id: null });
      expect(result.success).toBe(true);
    });

    it('should require target_hours > 0', () => {
      expect(MonthlyGoalSchema.safeParse({ ...validGoal, target_hours: 0 }).success).toBe(false);
      expect(MonthlyGoalSchema.safeParse({ ...validGoal, target_hours: -1 }).success).toBe(false);
      expect(MonthlyGoalSchema.safeParse({ ...validGoal, target_hours: 0.5 }).success).toBe(true);
    });

    it('should validate month as date string', () => {
      expect(MonthlyGoalSchema.safeParse({ ...validGoal, month: '2024-03-01' }).success).toBe(true);
      expect(MonthlyGoalSchema.safeParse({ ...validGoal, month: 'invalid' }).success).toBe(false);
    });
  });

  describe('CreateGoalSchema', () => {
    const validCreate = {
      month: '2024-03-01',
      category_id: '123e4567-e89b-12d3-a456-426614174000',
      target_hours: 40,
    };

    it('should accept valid create data', () => {
      const result = CreateGoalSchema.safeParse(validCreate);
      expect(result.success).toBe(true);
    });

    it('should REJECT server-managed fields', () => {
      const schema = CreateGoalSchema.shape;

      expect('id' in schema).toBe(false);
      expect('user_id' in schema).toBe(false);
    });

    it('should allow null category_id (overall goal)', () => {
      const result = CreateGoalSchema.safeParse({ ...validCreate, category_id: null });
      expect(result.success).toBe(true);
    });
  });

  describe('UpdateGoalSchema', () => {
    it('should accept valid update data', () => {
      const result = UpdateGoalSchema.safeParse({ target_hours: 50 });
      expect(result.success).toBe(true);
    });

    it('should REJECT server-managed fields', () => {
      const schema = UpdateGoalSchema.shape;

      expect('id' in schema).toBe(false);
      expect('user_id' in schema).toBe(false);
    });

    it('should accept empty object', () => {
      const result = UpdateGoalSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('should validate target_hours > 0', () => {
      expect(UpdateGoalSchema.safeParse({ target_hours: 0 }).success).toBe(false);
      expect(UpdateGoalSchema.safeParse({ target_hours: 0.5 }).success).toBe(true);
    });
  });

  describe('SetOverallGoalSchema', () => {
    it('should accept valid overall goal', () => {
      const result = SetOverallGoalSchema.safeParse({
        month: '2024-03-01',
        target_hours: 40,
      });
      expect(result.success).toBe(true);
    });

    it('should NOT include category_id (overall goals only)', () => {
      const schema = SetOverallGoalSchema.shape;
      expect('category_id' in schema).toBe(false);
    });
  });

  describe('SetCategoryGoalSchema', () => {
    it('should accept valid category goal', () => {
      const result = SetCategoryGoalSchema.safeParse({
        month: '2024-03-01',
        category_id: '123e4567-e89b-12d3-a456-426614174000',
        target_hours: 20,
      });
      expect(result.success).toBe(true);
    });

    it('should require category_id (per-category goals only)', () => {
      const result = SetCategoryGoalSchema.safeParse({
        month: '2024-03-01',
        target_hours: 20,
        // missing category_id
      });
      expect(result.success).toBe(false);
    });
  });
});
