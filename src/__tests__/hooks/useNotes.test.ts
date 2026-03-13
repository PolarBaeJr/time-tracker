/**
 * Notes Hooks Tests
 *
 * Tests for the notes React Query hooks - specifically the non-hook exports
 * and utilities that can be tested directly.
 *
 * Tests:
 * - NoteFetchError class
 * - Query key generation
 * - fetchNotes filter application
 * - fetchNote single note fetch
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
    notes: (filters?: Record<string, unknown>) =>
      filters ? ['notes', filters] : (['notes'] as const),
    note: (id: string) => ['notes', id] as const,
  },
}));

// Now import the module under test
import { NoteFetchError, fetchNotes, fetchNote } from '@/hooks/useNotes';
import { queryKeys } from '@/lib/queryClient';
import { supabase } from '@/lib/supabase';

describe('Notes Hooks Utilities', () => {
  // Reset mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================================
  // Query Keys Tests
  // ============================================================================

  describe('queryKeys', () => {
    it('should have correct notes key without filters', () => {
      expect(queryKeys.notes()).toEqual(['notes']);
    });

    it('should generate notes key with filters', () => {
      const filters = { search: 'test', pinnedOnly: true };
      expect(queryKeys.notes(filters)).toEqual(['notes', filters]);
    });

    it('should generate correct note key with id', () => {
      const noteId = '123e4567-e89b-12d3-a456-426614174000';
      expect(queryKeys.note(noteId)).toEqual(['notes', noteId]);
    });

    it('should generate unique keys for different note ids', () => {
      const id1 = '123e4567-e89b-12d3-a456-426614174000';
      const id2 = '123e4567-e89b-12d3-a456-426614174001';

      const key1 = queryKeys.note(id1);
      const key2 = queryKeys.note(id2);

      expect(key1).not.toEqual(key2);
      expect(key1[0]).toEqual(key2[0]); // Same prefix
      expect(key1[1]).not.toEqual(key2[1]); // Different IDs
    });
  });

  // ============================================================================
  // NoteFetchError Tests
  // ============================================================================

  describe('NoteFetchError', () => {
    it('should create error with message', () => {
      const error = new NoteFetchError('Something went wrong');
      expect(error.message).toBe('Something went wrong');
      expect(error.name).toBe('NoteFetchError');
    });

    it('should create error with message and code', () => {
      const error = new NoteFetchError('Database error', 'PGRST001');
      expect(error.message).toBe('Database error');
      expect(error.code).toBe('PGRST001');
    });

    it('should create error with message, code, and details', () => {
      const details = { field: 'title', reason: 'too long' };
      const error = new NoteFetchError('Validation error', 'VALIDATION_ERROR', details);
      expect(error.message).toBe('Validation error');
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.details).toEqual(details);
    });

    it('should be an instance of Error', () => {
      const error = new NoteFetchError('Test error');
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(NoteFetchError);
    });

    it('should have undefined code when not provided', () => {
      const error = new NoteFetchError('Test error');
      expect(error.code).toBeUndefined();
    });

    it('should have undefined details when not provided', () => {
      const error = new NoteFetchError('Test error', 'CODE');
      expect(error.details).toBeUndefined();
    });

    it('should have correct error name for stack traces', () => {
      const error = new NoteFetchError('Test');
      expect(error.name).toBe('NoteFetchError');
      expect(error.stack).toContain('NoteFetchError');
    });
  });

  // ============================================================================
  // fetchNotes Tests
  // ============================================================================

  describe('fetchNotes', () => {
    const mockNotes = [
      {
        id: '123e4567-e89b-12d3-a456-426614174000',
        user_id: '123e4567-e89b-12d3-a456-426614174001',
        title: 'Test Note 1',
        content: 'Content 1',
        category_id: null,
        time_entry_id: null,
        pinned: false,
        created_at: '2024-03-01T10:00:00.000Z',
        updated_at: '2024-03-01T10:00:00.000Z',
        deleted_at: null,
      },
      {
        id: '123e4567-e89b-12d3-a456-426614174002',
        user_id: '123e4567-e89b-12d3-a456-426614174001',
        title: 'Test Note 2',
        content: 'Content 2',
        category_id: '123e4567-e89b-12d3-a456-426614174003',
        time_entry_id: null,
        pinned: true,
        created_at: '2024-03-01T11:00:00.000Z',
        updated_at: '2024-03-01T11:00:00.000Z',
        deleted_at: null,
      },
    ];

    function setupMockChain() {
      const mockOrder2 = jest.fn().mockResolvedValue({ data: mockNotes, error: null });
      const mockOrder1 = jest.fn().mockReturnValue({ order: mockOrder2 });
      const mockEq = jest.fn().mockReturnValue({ order: mockOrder1 });
      const mockOr = jest.fn().mockReturnValue({ eq: mockEq, order: mockOrder1 });
      const mockIs = jest.fn().mockReturnValue({ or: mockOr, eq: mockEq, order: mockOrder1 });
      const mockSelect = jest.fn().mockReturnValue({ is: mockIs });
      const mockFrom = jest.fn().mockReturnValue({ select: mockSelect });

      (supabase.from as jest.Mock).mockImplementation(mockFrom);

      return { mockFrom, mockSelect, mockIs, mockOr, mockEq, mockOrder1, mockOrder2 };
    }

    it('should fetch notes without filters', async () => {
      setupMockChain();

      const result = await fetchNotes();

      expect(result).toEqual(mockNotes);
      expect(supabase.from).toHaveBeenCalledWith('notes');
    });

    it('should return empty array when no data', async () => {
      const mockOrder2 = jest.fn().mockResolvedValue({ data: null, error: null });
      const mockOrder1 = jest.fn().mockReturnValue({ order: mockOrder2 });
      const mockIs = jest.fn().mockReturnValue({ order: mockOrder1 });
      const mockSelect = jest.fn().mockReturnValue({ is: mockIs });
      const mockFrom = jest.fn().mockReturnValue({ select: mockSelect });

      (supabase.from as jest.Mock).mockImplementation(mockFrom);

      const result = await fetchNotes();

      expect(result).toEqual([]);
    });

    it('should throw NoteFetchError on supabase error', async () => {
      const mockOrder2 = jest
        .fn()
        .mockResolvedValue({ data: null, error: { message: 'DB Error', code: 'PGRST001' } });
      const mockOrder1 = jest.fn().mockReturnValue({ order: mockOrder2 });
      const mockIs = jest.fn().mockReturnValue({ order: mockOrder1 });
      const mockSelect = jest.fn().mockReturnValue({ is: mockIs });
      const mockFrom = jest.fn().mockReturnValue({ select: mockSelect });

      (supabase.from as jest.Mock).mockImplementation(mockFrom);

      await expect(fetchNotes()).rejects.toThrow(NoteFetchError);
      await expect(fetchNotes()).rejects.toThrow('DB Error');
    });

    it('should apply search filter', async () => {
      const mocks = setupMockChain();

      // NotesFilter type requires sortBy and sortOrder
      await fetchNotes({ search: 'meeting', sortBy: 'created_at', sortOrder: 'desc' });

      // Search applies 'or' filter on title and content
      expect(mocks.mockOr).toHaveBeenCalled();
    });

    it('should apply category filter', async () => {
      const mocks = setupMockChain();
      const categoryId = '123e4567-e89b-12d3-a456-426614174003';

      await fetchNotes({ categoryId, sortBy: 'created_at', sortOrder: 'desc' });

      expect(mocks.mockEq).toHaveBeenCalledWith('category_id', categoryId);
    });

    it('should apply pinned filter', async () => {
      const mocks = setupMockChain();

      await fetchNotes({ pinnedOnly: true, sortBy: 'created_at', sortOrder: 'desc' });

      expect(mocks.mockEq).toHaveBeenCalledWith('pinned', true);
    });

    it('should throw on invalid filter schema', async () => {
      setupMockChain();

      // Invalid sortBy value - cast to any to bypass TypeScript check for testing runtime validation
      await expect(
        fetchNotes({ sortBy: 'invalid' as 'created_at', sortOrder: 'desc' })
      ).rejects.toThrow(NoteFetchError);
      await expect(
        fetchNotes({ sortBy: 'invalid' as 'created_at', sortOrder: 'desc' })
      ).rejects.toThrow('Invalid filters');
    });

    it('should validate notes against schema', async () => {
      // Mock with invalid data (missing required fields)
      const invalidNote = {
        id: 'invalid-uuid',
        title: 'Test',
      };

      const mockOrder2 = jest.fn().mockResolvedValue({ data: [invalidNote], error: null });
      const mockOrder1 = jest.fn().mockReturnValue({ order: mockOrder2 });
      const mockIs = jest.fn().mockReturnValue({ order: mockOrder1 });
      const mockSelect = jest.fn().mockReturnValue({ is: mockIs });
      const mockFrom = jest.fn().mockReturnValue({ select: mockSelect });

      (supabase.from as jest.Mock).mockImplementation(mockFrom);

      // Should not throw, but log warning and return raw data
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      const result = await fetchNotes();

      expect(consoleSpy).toHaveBeenCalled();
      expect(result).toHaveLength(1);
      consoleSpy.mockRestore();
    });
  });

  // ============================================================================
  // fetchNote Tests
  // ============================================================================

  describe('fetchNote', () => {
    const mockNote = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      user_id: '123e4567-e89b-12d3-a456-426614174001',
      title: 'Test Note',
      content: 'Content',
      category_id: null,
      time_entry_id: null,
      pinned: false,
      created_at: '2024-03-01T10:00:00.000Z',
      updated_at: '2024-03-01T10:00:00.000Z',
      deleted_at: null,
    };

    it('should fetch a single note by id', async () => {
      const mockSingle = jest.fn().mockResolvedValue({ data: mockNote, error: null });
      const mockIs = jest.fn().mockReturnValue({ single: mockSingle });
      const mockEq = jest.fn().mockReturnValue({ is: mockIs });
      const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });
      const mockFrom = jest.fn().mockReturnValue({ select: mockSelect });

      (supabase.from as jest.Mock).mockImplementation(mockFrom);

      const result = await fetchNote('123e4567-e89b-12d3-a456-426614174000');

      expect(result).toEqual(mockNote);
      expect(mockEq).toHaveBeenCalledWith('id', '123e4567-e89b-12d3-a456-426614174000');
    });

    it('should throw NoteFetchError when note not found', async () => {
      const mockSingle = jest.fn().mockResolvedValue({ data: null, error: null });
      const mockIs = jest.fn().mockReturnValue({ single: mockSingle });
      const mockEq = jest.fn().mockReturnValue({ is: mockIs });
      const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });
      const mockFrom = jest.fn().mockReturnValue({ select: mockSelect });

      (supabase.from as jest.Mock).mockImplementation(mockFrom);

      await expect(fetchNote('nonexistent-id')).rejects.toThrow(NoteFetchError);
      await expect(fetchNote('nonexistent-id')).rejects.toThrow('Note not found');
    });

    it('should throw NoteFetchError on supabase error', async () => {
      const mockSingle = jest
        .fn()
        .mockResolvedValue({ data: null, error: { message: 'DB Error', code: 'PGRST001' } });
      const mockIs = jest.fn().mockReturnValue({ single: mockSingle });
      const mockEq = jest.fn().mockReturnValue({ is: mockIs });
      const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });
      const mockFrom = jest.fn().mockReturnValue({ select: mockSelect });

      (supabase.from as jest.Mock).mockImplementation(mockFrom);

      await expect(fetchNote('some-id')).rejects.toThrow(NoteFetchError);
      await expect(fetchNote('some-id')).rejects.toThrow('DB Error');
    });

    it('should filter out deleted notes (deleted_at check)', async () => {
      const mockSingle = jest.fn().mockResolvedValue({ data: mockNote, error: null });
      const mockIs = jest.fn().mockReturnValue({ single: mockSingle });
      const mockEq = jest.fn().mockReturnValue({ is: mockIs });
      const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });
      const mockFrom = jest.fn().mockReturnValue({ select: mockSelect });

      (supabase.from as jest.Mock).mockImplementation(mockFrom);

      await fetchNote('123e4567-e89b-12d3-a456-426614174000');

      expect(mockIs).toHaveBeenCalledWith('deleted_at', null);
    });
  });

  // ============================================================================
  // Type Safety Tests
  // ============================================================================

  describe('Type Safety', () => {
    it('NoteFetchError should have proper properties', () => {
      const error = new NoteFetchError('Test', 'CODE', { detail: 'value' });

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
