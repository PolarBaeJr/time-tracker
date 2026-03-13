/**
 * Todos Hooks Tests
 *
 * Tests for the todos React Query hooks - specifically the non-hook exports
 * and utilities that can be tested directly.
 *
 * Tests:
 * - TodoError class
 * - Query key generation
 * - fetchTodos filter application
 * - fetchTodo single todo fetch
 *
 * Note: Full hook integration tests require renderHook from @testing-library/react-hooks
 */

// Mock dependencies BEFORE importing the module under test
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

jest.mock('@/lib/queryClient', () => ({
  queryKeys: {
    todos: (filters?: Record<string, unknown>) =>
      filters ? ['todos', filters] : (['todos'] as const),
    todo: (id: string) => ['todos', id] as const,
  },
}));

// Now import the module under test
import { TodoError, fetchTodos, fetchTodo } from '@/hooks/useTodos';
import { queryKeys } from '@/lib/queryClient';
import { supabase } from '@/lib/supabase';

describe('Todos Hooks Utilities', () => {
  // Reset mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================================
  // Query Keys Tests
  // ============================================================================

  describe('queryKeys', () => {
    it('should have correct todos key without filters', () => {
      expect(queryKeys.todos()).toEqual(['todos']);
    });

    it('should generate todos key with filters', () => {
      const filters = { completed: true, priority: ['high'] };
      expect(queryKeys.todos(filters)).toEqual(['todos', filters]);
    });

    it('should generate correct todo key with id', () => {
      const todoId = '123e4567-e89b-12d3-a456-426614174000';
      expect(queryKeys.todo(todoId)).toEqual(['todos', todoId]);
    });

    it('should generate unique keys for different todo ids', () => {
      const id1 = '123e4567-e89b-12d3-a456-426614174000';
      const id2 = '123e4567-e89b-12d3-a456-426614174001';

      const key1 = queryKeys.todo(id1);
      const key2 = queryKeys.todo(id2);

      expect(key1).not.toEqual(key2);
      expect(key1[0]).toEqual(key2[0]); // Same prefix
      expect(key1[1]).not.toEqual(key2[1]); // Different IDs
    });
  });

  // ============================================================================
  // TodoError Tests
  // ============================================================================

  describe('TodoError', () => {
    it('should create error with message', () => {
      const error = new TodoError('Something went wrong');
      expect(error.message).toBe('Something went wrong');
      expect(error.name).toBe('TodoError');
    });

    it('should create error with message and code', () => {
      const error = new TodoError('Database error', 'PGRST001');
      expect(error.message).toBe('Database error');
      expect(error.code).toBe('PGRST001');
    });

    it('should create error with message, code, and details', () => {
      const details = { field: 'title', reason: 'too long' };
      const error = new TodoError('Validation error', 'VALIDATION_ERROR', details);
      expect(error.message).toBe('Validation error');
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.details).toEqual(details);
    });

    it('should be an instance of Error', () => {
      const error = new TodoError('Test error');
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(TodoError);
    });

    it('should have undefined code when not provided', () => {
      const error = new TodoError('Test error');
      expect(error.code).toBeUndefined();
    });

    it('should have undefined details when not provided', () => {
      const error = new TodoError('Test error', 'CODE');
      expect(error.details).toBeUndefined();
    });

    it('should have correct error name for stack traces', () => {
      const error = new TodoError('Test');
      expect(error.name).toBe('TodoError');
      expect(error.stack).toContain('TodoError');
    });
  });

  // ============================================================================
  // fetchTodos Tests
  // ============================================================================

  describe('fetchTodos', () => {
    const mockTodos = [
      {
        id: '123e4567-e89b-12d3-a456-426614174000',
        user_id: '123e4567-e89b-12d3-a456-426614174001',
        title: 'Test Todo 1',
        content: 'Content 1',
        category_id: null,
        time_entry_id: null,
        is_completed: false,
        completed_at: null,
        due_date: '2024-03-15',
        priority: 'medium',
        position: 0,
        created_at: '2024-03-01T10:00:00.000Z',
        updated_at: '2024-03-01T10:00:00.000Z',
        deleted_at: null,
      },
      {
        id: '123e4567-e89b-12d3-a456-426614174002',
        user_id: '123e4567-e89b-12d3-a456-426614174001',
        title: 'Test Todo 2',
        content: null,
        category_id: '123e4567-e89b-12d3-a456-426614174003',
        time_entry_id: null,
        is_completed: true,
        completed_at: '2024-03-10T12:00:00.000Z',
        due_date: null,
        priority: 'high',
        position: 1,
        created_at: '2024-03-01T11:00:00.000Z',
        updated_at: '2024-03-10T12:00:00.000Z',
        deleted_at: null,
      },
    ];

    /**
     * Creates a self-referencing mock chain that supports any order of method calls.
     * Each method returns an object containing all methods, allowing flexible chaining.
     *
     * The fetchTodos function:
     * 1. Calls .order(primary) - always
     * 2. May call .order(secondary) - only if sortColumn !== 'position'
     * 3. Awaits the final result
     *
     * To handle this, we create a thenable mock that:
     * - Has an .order() method for potential secondary sort
     * - Is thenable (has .then()) so await works on it
     */
    function setupMockChain(resolveData: unknown = mockTodos, resolveError: unknown = null) {
      const createChainableProxy = () => {
        const methods: {
          select: jest.Mock;
          is: jest.Mock;
          eq: jest.Mock;
          in: jest.Mock;
          not: jest.Mock;
          lte: jest.Mock;
          gte: jest.Mock;
          ilike: jest.Mock;
          order: jest.Mock;
        } = {
          select: jest.fn(),
          is: jest.fn(),
          eq: jest.fn(),
          in: jest.fn(),
          not: jest.fn(),
          lte: jest.fn(),
          gte: jest.fn(),
          ilike: jest.fn(),
          order: jest.fn(),
        };

        // Create a thenable result that also supports .order() chaining
        const createThenableResult = () => {
          const result = {
            // Support await directly on this object
            then: (resolve: (value: unknown) => void) => {
              resolve({ data: resolveData, error: resolveError });
              return Promise.resolve({ data: resolveData, error: resolveError });
            },
            // Support .order() chaining for secondary sort
            order: jest.fn(),
          };
          // Secondary order also returns a thenable
          result.order.mockReturnValue(result);
          return result;
        };

        // Order returns a thenable that can also be chained
        methods.order = jest.fn().mockReturnValue(createThenableResult());

        // All other methods return the proxy (for flexible chaining)
        methods.select.mockReturnValue(methods);
        methods.is.mockReturnValue(methods);
        methods.eq.mockReturnValue(methods);
        methods.in.mockReturnValue(methods);
        methods.not.mockReturnValue(methods);
        methods.lte.mockReturnValue(methods);
        methods.gte.mockReturnValue(methods);
        methods.ilike.mockReturnValue(methods);

        return methods;
      };

      const chainMethods = createChainableProxy();
      const mockFrom = jest.fn().mockReturnValue(chainMethods);
      (supabase.from as jest.Mock).mockImplementation(mockFrom);

      return { mockFrom, ...chainMethods };
    }

    it('should fetch todos without filters', async () => {
      setupMockChain();

      const result = await fetchTodos();

      expect(result).toEqual(mockTodos);
      expect(supabase.from).toHaveBeenCalledWith('todos');
    });

    it('should return empty array when no data', async () => {
      setupMockChain(null, null);

      const result = await fetchTodos();

      expect(result).toEqual([]);
    });

    it('should throw TodoError on supabase error', async () => {
      setupMockChain(null, { message: 'DB Error', code: 'PGRST001' });

      await expect(fetchTodos()).rejects.toThrow(TodoError);
    });

    it('should apply completed filter', async () => {
      const mocks = setupMockChain();

      await fetchTodos({ completed: true });

      expect(mocks.eq).toHaveBeenCalledWith('is_completed', true);
    });

    it('should apply priority filter with array', async () => {
      const mocks = setupMockChain();

      await fetchTodos({ priority: ['high', 'urgent'] });

      expect(mocks.in).toHaveBeenCalledWith('priority', ['high', 'urgent']);
    });

    it('should apply category filter', async () => {
      const mocks = setupMockChain();
      const categoryId = '123e4567-e89b-12d3-a456-426614174003';

      await fetchTodos({ categoryId });

      expect(mocks.eq).toHaveBeenCalledWith('category_id', categoryId);
    });

    it('should apply hasDueDate filter when true', async () => {
      const mocks = setupMockChain();

      await fetchTodos({ hasDueDate: true });

      expect(mocks.not).toHaveBeenCalledWith('due_date', 'is', null);
    });

    it('should apply hasDueDate filter when false', async () => {
      const mocks = setupMockChain();

      await fetchTodos({ hasDueDate: false });

      // When hasDueDate is false, it calls .is('due_date', null)
      expect(mocks.is).toHaveBeenCalled();
    });

    it('should apply dueBefore filter', async () => {
      const mocks = setupMockChain();

      await fetchTodos({ dueBefore: '2024-04-01' });

      expect(mocks.lte).toHaveBeenCalledWith('due_date', '2024-04-01');
    });

    it('should apply dueAfter filter', async () => {
      const mocks = setupMockChain();

      await fetchTodos({ dueAfter: '2024-03-01' });

      expect(mocks.gte).toHaveBeenCalledWith('due_date', '2024-03-01');
    });

    it('should apply search filter', async () => {
      const mocks = setupMockChain();

      await fetchTodos({ search: 'project' });

      expect(mocks.ilike).toHaveBeenCalledWith('title', '%project%');
    });

    it('should apply sorting', async () => {
      const mocks = setupMockChain();

      await fetchTodos({ sortBy: 'due_date', sortOrder: 'desc' });

      expect(mocks.order).toHaveBeenCalledWith('due_date', { ascending: false });
    });

    it('should default to position sort ascending', async () => {
      const mocks = setupMockChain();

      await fetchTodos();

      expect(mocks.order).toHaveBeenCalledWith('position', { ascending: true });
    });

    it('should throw on invalid filter schema', async () => {
      setupMockChain();

      // Invalid sortBy value - cast to bypass TypeScript for testing runtime validation
      await expect(
        fetchTodos({ sortBy: 'invalid' as 'position', sortOrder: 'desc' })
      ).rejects.toThrow(TodoError);
      await expect(
        fetchTodos({ sortBy: 'invalid' as 'position', sortOrder: 'desc' })
      ).rejects.toThrow('Invalid filters');
    });

    it('should validate todos against schema', async () => {
      // Mock with invalid data (missing required fields)
      const invalidTodo = {
        id: 'invalid-uuid',
        title: 'Test',
      };

      setupMockChain([invalidTodo], null);

      // Should not throw, but log warning and return raw data
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      const result = await fetchTodos();

      expect(consoleSpy).toHaveBeenCalled();
      expect(result).toHaveLength(1);
      consoleSpy.mockRestore();
    });
  });

  // ============================================================================
  // fetchTodo Tests
  // ============================================================================

  describe('fetchTodo', () => {
    const mockTodo = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      user_id: '123e4567-e89b-12d3-a456-426614174001',
      title: 'Test Todo',
      content: 'Content',
      category_id: null,
      time_entry_id: null,
      is_completed: false,
      completed_at: null,
      due_date: '2024-03-15',
      priority: 'medium',
      position: 0,
      created_at: '2024-03-01T10:00:00.000Z',
      updated_at: '2024-03-01T10:00:00.000Z',
      deleted_at: null,
    };

    function setupSingleMockChain(resolveData: unknown = mockTodo, resolveError: unknown = null) {
      const mockSingle = jest.fn().mockResolvedValue({ data: resolveData, error: resolveError });
      const mockIs = jest.fn().mockReturnValue({ single: mockSingle });
      const mockEq = jest.fn().mockReturnValue({ is: mockIs });
      const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });
      const mockFrom = jest.fn().mockReturnValue({ select: mockSelect });

      (supabase.from as jest.Mock).mockImplementation(mockFrom);

      return { mockFrom, mockSelect, mockEq, mockIs, mockSingle };
    }

    it('should fetch a single todo by id', async () => {
      const mocks = setupSingleMockChain();

      const result = await fetchTodo('123e4567-e89b-12d3-a456-426614174000');

      expect(result).toEqual(mockTodo);
      expect(mocks.mockEq).toHaveBeenCalledWith('id', '123e4567-e89b-12d3-a456-426614174000');
    });

    it('should return null when todo not found (PGRST116)', async () => {
      setupSingleMockChain(null, { message: 'Not found', code: 'PGRST116' });

      const result = await fetchTodo('nonexistent-id');

      expect(result).toBeNull();
    });

    it('should return null when data is null', async () => {
      setupSingleMockChain(null, null);

      const result = await fetchTodo('some-id');

      expect(result).toBeNull();
    });

    it('should throw TodoError on supabase error (non-404)', async () => {
      setupSingleMockChain(null, { message: 'DB Error', code: 'PGRST001' });

      await expect(fetchTodo('some-id')).rejects.toThrow(TodoError);
    });

    it('should filter out deleted todos (deleted_at check)', async () => {
      const mocks = setupSingleMockChain();

      await fetchTodo('123e4567-e89b-12d3-a456-426614174000');

      expect(mocks.mockIs).toHaveBeenCalledWith('deleted_at', null);
    });
  });

  // ============================================================================
  // Type Safety Tests
  // ============================================================================

  describe('Type Safety', () => {
    it('TodoError should have proper properties', () => {
      const error = new TodoError('Test', 'CODE', { detail: 'value' });

      // These should be properly typed
      const message: string = error.message;
      const code: string | undefined = error.code;
      const details: unknown = error.details;

      expect(message).toBe('Test');
      expect(code).toBe('CODE');
      expect(details).toEqual({ detail: 'value' });
    });
  });
});
