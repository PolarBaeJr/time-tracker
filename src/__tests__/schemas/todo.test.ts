/**
 * Todo Schema Tests
 *
 * Tests all todo Zod schemas with valid and invalid inputs.
 * Tests TodoPriorityEnum, TodoSchema, CreateTodoSchema, UpdateTodoSchema,
 * TodosFilterSchema, and ReorderTodosSchema.
 */

import {
  TodoPriorityEnum,
  TodoSchema,
  CreateTodoSchema,
  UpdateTodoSchema,
  TodosFilterSchema,
  ReorderTodosSchema,
} from '@/schemas/todo';

describe('Todo Schemas', () => {
  // ============================================================================
  // TodoPriorityEnum Tests
  // ============================================================================

  describe('TodoPriorityEnum', () => {
    it('should accept "low" priority', () => {
      const result = TodoPriorityEnum.safeParse('low');
      expect(result.success).toBe(true);
    });

    it('should accept "medium" priority', () => {
      const result = TodoPriorityEnum.safeParse('medium');
      expect(result.success).toBe(true);
    });

    it('should accept "high" priority', () => {
      const result = TodoPriorityEnum.safeParse('high');
      expect(result.success).toBe(true);
    });

    it('should accept "urgent" priority', () => {
      const result = TodoPriorityEnum.safeParse('urgent');
      expect(result.success).toBe(true);
    });

    it('should reject invalid priority values', () => {
      expect(TodoPriorityEnum.safeParse('invalid').success).toBe(false);
      expect(TodoPriorityEnum.safeParse('critical').success).toBe(false);
      expect(TodoPriorityEnum.safeParse('LOW').success).toBe(false);
      expect(TodoPriorityEnum.safeParse('').success).toBe(false);
      expect(TodoPriorityEnum.safeParse(1).success).toBe(false);
    });
  });

  // ============================================================================
  // TodoSchema Tests
  // ============================================================================

  describe('TodoSchema', () => {
    const validTodo = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      user_id: '123e4567-e89b-12d3-a456-426614174001',
      title: 'Complete project documentation',
      content: 'Write comprehensive docs for the API endpoints.',
      category_id: '123e4567-e89b-12d3-a456-426614174002',
      time_entry_id: '123e4567-e89b-12d3-a456-426614174003',
      is_completed: false,
      completed_at: null,
      due_date: '2024-03-15',
      priority: 'high',
      position: 0,
      created_at: '2024-03-01T10:00:00.000Z',
      updated_at: '2024-03-01T10:30:00.000Z',
      deleted_at: null,
    };

    it('should accept valid todo data', () => {
      const result = TodoSchema.safeParse(validTodo);
      expect(result.success).toBe(true);
    });

    it('should require valid UUID for id', () => {
      const result = TodoSchema.safeParse({ ...validTodo, id: 'invalid' });
      expect(result.success).toBe(false);
    });

    it('should require valid UUID for user_id', () => {
      const result = TodoSchema.safeParse({ ...validTodo, user_id: 'invalid' });
      expect(result.success).toBe(false);
    });

    it('should allow null category_id', () => {
      const result = TodoSchema.safeParse({ ...validTodo, category_id: null });
      expect(result.success).toBe(true);
    });

    it('should require valid UUID for category_id when not null', () => {
      const result = TodoSchema.safeParse({ ...validTodo, category_id: 'invalid' });
      expect(result.success).toBe(false);
    });

    it('should allow null time_entry_id', () => {
      const result = TodoSchema.safeParse({ ...validTodo, time_entry_id: null });
      expect(result.success).toBe(true);
    });

    it('should require valid UUID for time_entry_id when not null', () => {
      const result = TodoSchema.safeParse({ ...validTodo, time_entry_id: 'invalid' });
      expect(result.success).toBe(false);
    });

    it('should allow null content', () => {
      const result = TodoSchema.safeParse({ ...validTodo, content: null });
      expect(result.success).toBe(true);
    });

    it('should validate title max length (500)', () => {
      const maxTitle = 'a'.repeat(500);
      expect(TodoSchema.safeParse({ ...validTodo, title: maxTitle }).success).toBe(true);

      const tooLongTitle = 'a'.repeat(501);
      expect(TodoSchema.safeParse({ ...validTodo, title: tooLongTitle }).success).toBe(false);
    });

    it('should validate content max length (5000)', () => {
      const maxContent = 'a'.repeat(5000);
      expect(TodoSchema.safeParse({ ...validTodo, content: maxContent }).success).toBe(true);

      const tooLongContent = 'a'.repeat(5001);
      expect(TodoSchema.safeParse({ ...validTodo, content: tooLongContent }).success).toBe(false);
    });

    it('should default is_completed to false', () => {
      const { is_completed, ...withoutCompleted } = validTodo;
      const result = TodoSchema.safeParse(withoutCompleted);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.is_completed).toBe(false);
      }
    });

    it('should allow null completed_at', () => {
      const result = TodoSchema.safeParse({ ...validTodo, completed_at: null });
      expect(result.success).toBe(true);
    });

    it('should require valid datetime for completed_at when not null', () => {
      const validResult = TodoSchema.safeParse({
        ...validTodo,
        completed_at: '2024-03-01T12:00:00.000Z',
      });
      expect(validResult.success).toBe(true);

      const invalidResult = TodoSchema.safeParse({
        ...validTodo,
        completed_at: 'invalid-date',
      });
      expect(invalidResult.success).toBe(false);
    });

    it('should allow null due_date', () => {
      const result = TodoSchema.safeParse({ ...validTodo, due_date: null });
      expect(result.success).toBe(true);
    });

    it('should validate due_date format (YYYY-MM-DD)', () => {
      const validDate = TodoSchema.safeParse({ ...validTodo, due_date: '2024-03-15' });
      expect(validDate.success).toBe(true);

      const invalidDate = TodoSchema.safeParse({ ...validTodo, due_date: '03/15/2024' });
      expect(invalidDate.success).toBe(false);

      const invalidFormat = TodoSchema.safeParse({ ...validTodo, due_date: '2024-3-15' });
      expect(invalidFormat.success).toBe(false);
    });

    it('should validate priority with TodoPriorityEnum', () => {
      const priorities = ['low', 'medium', 'high', 'urgent'];
      priorities.forEach(priority => {
        const result = TodoSchema.safeParse({ ...validTodo, priority });
        expect(result.success).toBe(true);
      });

      const invalidResult = TodoSchema.safeParse({ ...validTodo, priority: 'invalid' });
      expect(invalidResult.success).toBe(false);
    });

    it('should default priority to medium', () => {
      const { priority, ...withoutPriority } = validTodo;
      const result = TodoSchema.safeParse(withoutPriority);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.priority).toBe('medium');
      }
    });

    it('should require position to be non-negative integer', () => {
      expect(TodoSchema.safeParse({ ...validTodo, position: 0 }).success).toBe(true);
      expect(TodoSchema.safeParse({ ...validTodo, position: 100 }).success).toBe(true);

      expect(TodoSchema.safeParse({ ...validTodo, position: -1 }).success).toBe(false);
      expect(TodoSchema.safeParse({ ...validTodo, position: 1.5 }).success).toBe(false);
    });

    it('should require valid datetime for created_at', () => {
      const result = TodoSchema.safeParse({ ...validTodo, created_at: 'invalid-date' });
      expect(result.success).toBe(false);
    });

    it('should require valid datetime for updated_at', () => {
      const result = TodoSchema.safeParse({ ...validTodo, updated_at: 'invalid-date' });
      expect(result.success).toBe(false);
    });

    it('should allow null deleted_at', () => {
      const result = TodoSchema.safeParse({ ...validTodo, deleted_at: null });
      expect(result.success).toBe(true);
    });

    it('should allow optional deleted_at', () => {
      const { deleted_at, ...withoutDeletedAt } = validTodo;
      const result = TodoSchema.safeParse(withoutDeletedAt);
      expect(result.success).toBe(true);
    });

    it('should reject missing required fields', () => {
      const { id, ...withoutId } = validTodo;
      expect(TodoSchema.safeParse(withoutId).success).toBe(false);

      const { user_id, ...withoutUserId } = validTodo;
      expect(TodoSchema.safeParse(withoutUserId).success).toBe(false);

      const { title, ...withoutTitle } = validTodo;
      expect(TodoSchema.safeParse(withoutTitle).success).toBe(false);

      const { position, ...withoutPosition } = validTodo;
      expect(TodoSchema.safeParse(withoutPosition).success).toBe(false);
    });
  });

  // ============================================================================
  // CreateTodoSchema Tests
  // ============================================================================

  describe('CreateTodoSchema', () => {
    const validCreate = {
      title: 'New Todo',
      content: 'Some content here',
      category_id: '123e4567-e89b-12d3-a456-426614174000',
      time_entry_id: '123e4567-e89b-12d3-a456-426614174001',
      is_completed: false,
      due_date: '2024-03-15',
      priority: 'medium',
      position: 0,
    };

    it('should accept valid create data', () => {
      const result = CreateTodoSchema.safeParse(validCreate);
      expect(result.success).toBe(true);
    });

    it('should reject empty title', () => {
      const result = CreateTodoSchema.safeParse({ ...validCreate, title: '' });
      expect(result.success).toBe(false);
    });

    it('should require title (not optional)', () => {
      const { title, ...withoutTitle } = validCreate;
      const result = CreateTodoSchema.safeParse(withoutTitle);
      expect(result.success).toBe(false);
    });

    it('should validate title min length (1)', () => {
      const result = CreateTodoSchema.safeParse({ ...validCreate, title: 'a' });
      expect(result.success).toBe(true);
    });

    it('should validate title max length (500)', () => {
      const maxTitle = 'a'.repeat(500);
      expect(CreateTodoSchema.safeParse({ ...validCreate, title: maxTitle }).success).toBe(true);

      const tooLongTitle = 'a'.repeat(501);
      expect(CreateTodoSchema.safeParse({ ...validCreate, title: tooLongTitle }).success).toBe(
        false
      );
    });

    it('should allow optional content', () => {
      const { content, ...withoutContent } = validCreate;
      const result = CreateTodoSchema.safeParse(withoutContent);
      expect(result.success).toBe(true);
    });

    it('should allow null content', () => {
      const result = CreateTodoSchema.safeParse({ ...validCreate, content: null });
      expect(result.success).toBe(true);
    });

    it('should validate content max length (5000)', () => {
      const maxContent = 'a'.repeat(5000);
      expect(CreateTodoSchema.safeParse({ ...validCreate, content: maxContent }).success).toBe(
        true
      );

      const tooLongContent = 'a'.repeat(5001);
      expect(CreateTodoSchema.safeParse({ ...validCreate, content: tooLongContent }).success).toBe(
        false
      );
    });

    it('should allow optional category_id', () => {
      const { category_id, ...withoutCategoryId } = validCreate;
      const result = CreateTodoSchema.safeParse(withoutCategoryId);
      expect(result.success).toBe(true);
    });

    it('should allow null category_id', () => {
      const result = CreateTodoSchema.safeParse({ ...validCreate, category_id: null });
      expect(result.success).toBe(true);
    });

    it('should require valid UUID for category_id when provided', () => {
      const result = CreateTodoSchema.safeParse({ ...validCreate, category_id: 'invalid' });
      expect(result.success).toBe(false);
    });

    it('should allow optional time_entry_id', () => {
      const { time_entry_id, ...withoutTimeEntryId } = validCreate;
      const result = CreateTodoSchema.safeParse(withoutTimeEntryId);
      expect(result.success).toBe(true);
    });

    it('should allow optional is_completed', () => {
      const { is_completed, ...withoutCompleted } = validCreate;
      const result = CreateTodoSchema.safeParse(withoutCompleted);
      expect(result.success).toBe(true);
    });

    it('should allow optional due_date', () => {
      const { due_date, ...withoutDueDate } = validCreate;
      const result = CreateTodoSchema.safeParse(withoutDueDate);
      expect(result.success).toBe(true);
    });

    it('should allow null due_date', () => {
      const result = CreateTodoSchema.safeParse({ ...validCreate, due_date: null });
      expect(result.success).toBe(true);
    });

    it('should validate due_date format when provided', () => {
      const validDate = CreateTodoSchema.safeParse({ ...validCreate, due_date: '2024-03-15' });
      expect(validDate.success).toBe(true);

      const invalidDate = CreateTodoSchema.safeParse({ ...validCreate, due_date: 'invalid' });
      expect(invalidDate.success).toBe(false);
    });

    it('should allow optional priority', () => {
      const { priority, ...withoutPriority } = validCreate;
      const result = CreateTodoSchema.safeParse(withoutPriority);
      expect(result.success).toBe(true);
    });

    it('should validate priority enum when provided', () => {
      const priorities = ['low', 'medium', 'high', 'urgent'];
      priorities.forEach(priority => {
        const result = CreateTodoSchema.safeParse({ title: 'Test', priority });
        expect(result.success).toBe(true);
      });

      const invalidResult = CreateTodoSchema.safeParse({ title: 'Test', priority: 'invalid' });
      expect(invalidResult.success).toBe(false);
    });

    it('should allow optional position', () => {
      const { position, ...withoutPosition } = validCreate;
      const result = CreateTodoSchema.safeParse(withoutPosition);
      expect(result.success).toBe(true);
    });

    it('should require position to be non-negative when provided', () => {
      expect(CreateTodoSchema.safeParse({ ...validCreate, position: 0 }).success).toBe(true);
      expect(CreateTodoSchema.safeParse({ ...validCreate, position: 100 }).success).toBe(true);

      expect(CreateTodoSchema.safeParse({ ...validCreate, position: -1 }).success).toBe(false);
    });

    it('should REJECT server-managed fields', () => {
      const schema = CreateTodoSchema.shape;

      // These fields should NOT be in CreateTodoSchema
      expect('id' in schema).toBe(false);
      expect('user_id' in schema).toBe(false);
      expect('created_at' in schema).toBe(false);
      expect('updated_at' in schema).toBe(false);
      expect('deleted_at' in schema).toBe(false);
      expect('completed_at' in schema).toBe(false);
    });

    it('should accept minimal valid data (title only)', () => {
      const result = CreateTodoSchema.safeParse({ title: 'Minimal Todo' });
      expect(result.success).toBe(true);
    });
  });

  // ============================================================================
  // UpdateTodoSchema Tests
  // ============================================================================

  describe('UpdateTodoSchema', () => {
    it('should accept valid update with title', () => {
      const result = UpdateTodoSchema.safeParse({ title: 'Updated Title' });
      expect(result.success).toBe(true);
    });

    it('should accept valid update with content', () => {
      const result = UpdateTodoSchema.safeParse({ content: 'Updated content' });
      expect(result.success).toBe(true);
    });

    it('should accept null content', () => {
      const result = UpdateTodoSchema.safeParse({ content: null });
      expect(result.success).toBe(true);
    });

    it('should accept valid update with is_completed', () => {
      const result = UpdateTodoSchema.safeParse({ is_completed: true });
      expect(result.success).toBe(true);
    });

    it('should accept valid update with completed_at', () => {
      const result = UpdateTodoSchema.safeParse({
        completed_at: '2024-03-01T12:00:00.000Z',
      });
      expect(result.success).toBe(true);
    });

    it('should accept null completed_at', () => {
      const result = UpdateTodoSchema.safeParse({ completed_at: null });
      expect(result.success).toBe(true);
    });

    it('should accept valid update with priority', () => {
      const result = UpdateTodoSchema.safeParse({ priority: 'urgent' });
      expect(result.success).toBe(true);
    });

    it('should accept valid update with due_date', () => {
      const result = UpdateTodoSchema.safeParse({ due_date: '2024-04-01' });
      expect(result.success).toBe(true);
    });

    it('should accept null due_date', () => {
      const result = UpdateTodoSchema.safeParse({ due_date: null });
      expect(result.success).toBe(true);
    });

    it('should accept valid update with position', () => {
      const result = UpdateTodoSchema.safeParse({ position: 5 });
      expect(result.success).toBe(true);
    });

    it('should accept empty object (no updates)', () => {
      const result = UpdateTodoSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('should reject empty title when provided', () => {
      const result = UpdateTodoSchema.safeParse({ title: '' });
      expect(result.success).toBe(false);
    });

    it('should validate title max length (500) when provided', () => {
      const maxTitle = 'a'.repeat(500);
      expect(UpdateTodoSchema.safeParse({ title: maxTitle }).success).toBe(true);

      const tooLongTitle = 'a'.repeat(501);
      expect(UpdateTodoSchema.safeParse({ title: tooLongTitle }).success).toBe(false);
    });

    it('should validate content max length (5000) when provided', () => {
      const maxContent = 'a'.repeat(5000);
      expect(UpdateTodoSchema.safeParse({ content: maxContent }).success).toBe(true);

      const tooLongContent = 'a'.repeat(5001);
      expect(UpdateTodoSchema.safeParse({ content: tooLongContent }).success).toBe(false);
    });

    it('should allow null category_id', () => {
      const result = UpdateTodoSchema.safeParse({ category_id: null });
      expect(result.success).toBe(true);
    });

    it('should require valid UUID for category_id when provided and not null', () => {
      const validResult = UpdateTodoSchema.safeParse({
        category_id: '123e4567-e89b-12d3-a456-426614174000',
      });
      expect(validResult.success).toBe(true);

      const invalidResult = UpdateTodoSchema.safeParse({ category_id: 'invalid' });
      expect(invalidResult.success).toBe(false);
    });

    it('should reject negative position when provided', () => {
      expect(UpdateTodoSchema.safeParse({ position: -1 }).success).toBe(false);
    });

    it('should REJECT server-managed fields', () => {
      const schema = UpdateTodoSchema.shape;

      expect('id' in schema).toBe(false);
      expect('user_id' in schema).toBe(false);
      expect('created_at' in schema).toBe(false);
      expect('updated_at' in schema).toBe(false);
      expect('deleted_at' in schema).toBe(false);
    });
  });

  // ============================================================================
  // TodosFilterSchema Tests
  // ============================================================================

  describe('TodosFilterSchema', () => {
    it('should accept valid filter with all fields', () => {
      const result = TodosFilterSchema.safeParse({
        completed: true,
        priority: ['high', 'urgent'],
        categoryId: '123e4567-e89b-12d3-a456-426614174000',
        hasDueDate: true,
        dueBefore: '2024-04-01',
        dueAfter: '2024-03-01',
        search: 'project',
        sortBy: 'due_date',
        sortOrder: 'asc',
      });
      expect(result.success).toBe(true);
    });

    it('should accept empty object (all optional)', () => {
      const result = TodosFilterSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('should accept boolean for completed filter', () => {
      expect(TodosFilterSchema.safeParse({ completed: true }).success).toBe(true);
      expect(TodosFilterSchema.safeParse({ completed: false }).success).toBe(true);
    });

    it('should accept array of priorities', () => {
      const result = TodosFilterSchema.safeParse({ priority: ['low', 'medium'] });
      expect(result.success).toBe(true);
    });

    it('should reject invalid priority values in array', () => {
      const result = TodosFilterSchema.safeParse({ priority: ['invalid'] });
      expect(result.success).toBe(false);
    });

    it('should accept empty priority array', () => {
      const result = TodosFilterSchema.safeParse({ priority: [] });
      expect(result.success).toBe(true);
    });

    it('should require valid UUID for categoryId when provided', () => {
      const validResult = TodosFilterSchema.safeParse({
        categoryId: '123e4567-e89b-12d3-a456-426614174000',
      });
      expect(validResult.success).toBe(true);

      const invalidResult = TodosFilterSchema.safeParse({ categoryId: 'invalid' });
      expect(invalidResult.success).toBe(false);
    });

    it('should accept boolean for hasDueDate', () => {
      expect(TodosFilterSchema.safeParse({ hasDueDate: true }).success).toBe(true);
      expect(TodosFilterSchema.safeParse({ hasDueDate: false }).success).toBe(true);
    });

    it('should validate dueBefore date format', () => {
      const validResult = TodosFilterSchema.safeParse({ dueBefore: '2024-03-15' });
      expect(validResult.success).toBe(true);

      const invalidResult = TodosFilterSchema.safeParse({ dueBefore: 'invalid' });
      expect(invalidResult.success).toBe(false);
    });

    it('should validate dueAfter date format', () => {
      const validResult = TodosFilterSchema.safeParse({ dueAfter: '2024-03-01' });
      expect(validResult.success).toBe(true);

      const invalidResult = TodosFilterSchema.safeParse({ dueAfter: 'invalid' });
      expect(invalidResult.success).toBe(false);
    });

    it('should allow optional search string', () => {
      const result = TodosFilterSchema.safeParse({ search: 'test query' });
      expect(result.success).toBe(true);
    });

    it('should validate sortBy enum values', () => {
      const validSortValues = ['position', 'due_date', 'priority', 'created_at', 'title'];
      validSortValues.forEach(sortBy => {
        expect(TodosFilterSchema.safeParse({ sortBy }).success).toBe(true);
      });

      expect(TodosFilterSchema.safeParse({ sortBy: 'invalid' }).success).toBe(false);
    });

    it('should validate sortOrder enum values', () => {
      expect(TodosFilterSchema.safeParse({ sortOrder: 'asc' }).success).toBe(true);
      expect(TodosFilterSchema.safeParse({ sortOrder: 'desc' }).success).toBe(true);
      expect(TodosFilterSchema.safeParse({ sortOrder: 'invalid' }).success).toBe(false);
    });

    it('should NOT have default values for sortBy and sortOrder', () => {
      // Note: Unlike NotesFilterSchema, TodosFilterSchema has optional sortBy/sortOrder without defaults
      const result = TodosFilterSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.sortBy).toBeUndefined();
        expect(result.data.sortOrder).toBeUndefined();
      }
    });
  });

  // ============================================================================
  // ReorderTodosSchema Tests
  // ============================================================================

  describe('ReorderTodosSchema', () => {
    it('should accept valid reorder array', () => {
      const result = ReorderTodosSchema.safeParse([
        { id: '123e4567-e89b-12d3-a456-426614174000', position: 0 },
        { id: '123e4567-e89b-12d3-a456-426614174001', position: 1 },
        { id: '123e4567-e89b-12d3-a456-426614174002', position: 2 },
      ]);
      expect(result.success).toBe(true);
    });

    it('should accept empty array', () => {
      const result = ReorderTodosSchema.safeParse([]);
      expect(result.success).toBe(true);
    });

    it('should accept single item array', () => {
      const result = ReorderTodosSchema.safeParse([
        { id: '123e4567-e89b-12d3-a456-426614174000', position: 5 },
      ]);
      expect(result.success).toBe(true);
    });

    it('should require valid UUID for id', () => {
      const result = ReorderTodosSchema.safeParse([{ id: 'invalid', position: 0 }]);
      expect(result.success).toBe(false);
    });

    it('should require non-negative integer for position', () => {
      expect(
        ReorderTodosSchema.safeParse([{ id: '123e4567-e89b-12d3-a456-426614174000', position: 0 }])
          .success
      ).toBe(true);

      expect(
        ReorderTodosSchema.safeParse([
          { id: '123e4567-e89b-12d3-a456-426614174000', position: 100 },
        ]).success
      ).toBe(true);

      expect(
        ReorderTodosSchema.safeParse([{ id: '123e4567-e89b-12d3-a456-426614174000', position: -1 }])
          .success
      ).toBe(false);

      expect(
        ReorderTodosSchema.safeParse([
          { id: '123e4567-e89b-12d3-a456-426614174000', position: 1.5 },
        ]).success
      ).toBe(false);
    });

    it('should require both id and position fields', () => {
      const missingId = ReorderTodosSchema.safeParse([{ position: 0 }]);
      expect(missingId.success).toBe(false);

      const missingPosition = ReorderTodosSchema.safeParse([
        { id: '123e4567-e89b-12d3-a456-426614174000' },
      ]);
      expect(missingPosition.success).toBe(false);
    });

    it('should reject non-array input', () => {
      expect(ReorderTodosSchema.safeParse({}).success).toBe(false);
      expect(ReorderTodosSchema.safeParse('string').success).toBe(false);
      expect(ReorderTodosSchema.safeParse(null).success).toBe(false);
    });
  });
});
