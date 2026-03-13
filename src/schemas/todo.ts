import { z } from 'zod';

/**
 * Todo Priority Enum
 *
 * Defines priority levels for todo items.
 * Matches the database ENUM: todo_priority
 */
export const TodoPriorityEnum = z.enum(['low', 'medium', 'high', 'urgent']);

/**
 * Todo Schema - Entity schema for query responses
 *
 * Represents a task item users can track alongside their time entries.
 * Supports priorities, due dates, categories, and ordering.
 */
export const TodoSchema = z.object({
  /** UUID primary key */
  id: z.string().uuid(),

  /** UUID of the owning user (server-managed via auth.uid()) */
  user_id: z.string().uuid(),

  /** Todo title (1-500 characters, required) */
  title: z.string().max(500),

  /** Optional content/notes (max 5000 characters) */
  content: z.string().max(5000).nullable(),

  /**
   * UUID of the associated category (nullable)
   * Set to NULL if category is deleted (ON DELETE SET NULL)
   */
  category_id: z.string().uuid().nullable(),

  /**
   * UUID of the associated time entry (nullable)
   * Set to NULL if time entry is deleted (ON DELETE SET NULL)
   */
  time_entry_id: z.string().uuid().nullable(),

  /** Whether the todo has been completed */
  is_completed: z.boolean().default(false),

  /** Timestamp when marked complete (null if not completed) */
  completed_at: z.string().datetime({ offset: true }).nullable(),

  /** Optional due date (date only, no time component) */
  due_date: z.string().date().nullable(),

  /** Priority level (low, medium, high, urgent) */
  priority: TodoPriorityEnum.default('medium'),

  /** Order position for drag-and-drop (lower = earlier) */
  position: z.number().int().nonnegative(),

  /** Timestamp when todo was created */
  created_at: z.string().datetime({ offset: true }),

  /** Timestamp when todo was last updated */
  updated_at: z.string().datetime({ offset: true }),

  /** Soft delete timestamp (null if not deleted) */
  deleted_at: z.string().datetime({ offset: true }).nullable().optional(),
});

/**
 * Create Todo Schema - Mutation schema for creating new todos
 *
 * EXCLUDES server-managed fields: id, user_id, created_at, updated_at
 * Position defaults to 0 (will be set to max + 1 by the hook)
 */
export const CreateTodoSchema = z.object({
  /** Todo title (1-500 characters, required) */
  title: z.string().min(1, 'Title is required').max(500),

  /** Optional content/notes (max 5000 characters) */
  content: z.string().max(5000).nullable().optional(),

  /** UUID of the associated category (optional) */
  category_id: z.string().uuid().nullable().optional(),

  /** UUID of the associated time entry (optional) */
  time_entry_id: z.string().uuid().nullable().optional(),

  /** Whether the todo is already completed */
  is_completed: z.boolean().optional(),

  /** Optional due date (date string in YYYY-MM-DD format) */
  due_date: z.string().date().nullable().optional(),

  /** Priority level (defaults to medium) */
  priority: TodoPriorityEnum.optional(),

  /** Position for ordering (optional, will be set automatically if not provided) */
  position: z.number().int().nonnegative().optional(),
});

/**
 * Update Todo Schema - Mutation schema for updating existing todos
 *
 * EXCLUDES server-managed fields: id, user_id, created_at, updated_at
 * All fields are optional for partial updates.
 */
export const UpdateTodoSchema = z.object({
  /** Todo title (1-500 characters) */
  title: z.string().min(1, 'Title is required').max(500).optional(),

  /** Content/notes (max 5000 characters) */
  content: z.string().max(5000).nullable().optional(),

  /** UUID of the associated category */
  category_id: z.string().uuid().nullable().optional(),

  /** UUID of the associated time entry */
  time_entry_id: z.string().uuid().nullable().optional(),

  /** Whether the todo is completed */
  is_completed: z.boolean().optional(),

  /** Timestamp when marked complete */
  completed_at: z.string().datetime({ offset: true }).nullable().optional(),

  /** Due date (date string in YYYY-MM-DD format) */
  due_date: z.string().date().nullable().optional(),

  /** Priority level */
  priority: TodoPriorityEnum.optional(),

  /** Position for ordering */
  position: z.number().int().nonnegative().optional(),
});

/**
 * Todos Filter Schema - For filtering todos in queries
 */
export const TodosFilterSchema = z.object({
  /** Filter by completion status */
  completed: z.boolean().optional(),

  /** Filter by priority levels (array of priorities) */
  priority: z.array(TodoPriorityEnum).optional(),

  /** Filter by category ID */
  categoryId: z.string().uuid().optional(),

  /** Filter to only show todos with a due date */
  hasDueDate: z.boolean().optional(),

  /** Filter todos due before this date (inclusive) */
  dueBefore: z.string().date().optional(),

  /** Filter todos due after this date (inclusive) */
  dueAfter: z.string().date().optional(),

  /** Search in title field */
  search: z.string().optional(),

  /** Sort field */
  sortBy: z.enum(['position', 'due_date', 'priority', 'created_at', 'title']).optional(),

  /** Sort order */
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

/**
 * Reorder Todos Schema - For batch updating todo positions
 */
export const ReorderTodosSchema = z.array(
  z.object({
    /** UUID of the todo to reorder */
    id: z.string().uuid(),

    /** New position for the todo */
    position: z.number().int().nonnegative(),
  })
);

// Inferred TypeScript types
export type TodoPriority = z.infer<typeof TodoPriorityEnum>;
export type Todo = z.infer<typeof TodoSchema>;
export type CreateTodoInput = z.infer<typeof CreateTodoSchema>;
export type UpdateTodoInput = z.infer<typeof UpdateTodoSchema>;
export type TodosFilter = z.infer<typeof TodosFilterSchema>;
export type ReorderTodosInput = z.infer<typeof ReorderTodosSchema>;
