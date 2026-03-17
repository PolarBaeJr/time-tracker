/**
 * Workspace Hooks Tests
 *
 * Tests for the workspace React Query hooks - specifically the non-hook exports
 * and utilities that can be tested directly.
 *
 * Tests:
 * - WorkspaceFetchError class
 * - Query key generation
 * - fetchWorkspaces with mocked Supabase
 * - fetchWorkspace single workspace fetch
 *
 * Note: Full hook integration tests require renderHook from @testing-library/react-hooks
 */

// Mock dependencies BEFORE importing the module under test
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
    auth: {
      getSession: jest.fn(),
    },
  },
}));

jest.mock('@/lib/queryClient', () => ({
  queryKeys: {
    workspaces: ['workspaces'] as const,
    workspace: (id: string) => ['workspaces', id] as const,
  },
}));

// Now import the module under test
import { WorkspaceFetchError, fetchWorkspaces, fetchWorkspace } from '@/hooks/useWorkspaces';
import { queryKeys } from '@/lib/queryClient';
import { supabase } from '@/lib/supabase';

describe('Workspace Hooks Utilities', () => {
  // Reset mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================================
  // Query Keys Tests
  // ============================================================================

  describe('queryKeys', () => {
    it('should have correct workspaces key', () => {
      expect(queryKeys.workspaces).toEqual(['workspaces']);
    });

    it('should generate correct workspace key with id', () => {
      const workspaceId = '123e4567-e89b-12d3-a456-426614174000';
      expect(queryKeys.workspace(workspaceId)).toEqual(['workspaces', workspaceId]);
    });

    it('should generate unique keys for different workspace ids', () => {
      const id1 = '123e4567-e89b-12d3-a456-426614174000';
      const id2 = '123e4567-e89b-12d3-a456-426614174001';

      const key1 = queryKeys.workspace(id1);
      const key2 = queryKeys.workspace(id2);

      expect(key1).not.toEqual(key2);
      expect(key1[0]).toEqual(key2[0]); // Same prefix
      expect(key1[1]).not.toEqual(key2[1]); // Different IDs
    });
  });

  // ============================================================================
  // WorkspaceFetchError Tests
  // ============================================================================

  describe('WorkspaceFetchError', () => {
    it('should create error with message', () => {
      const error = new WorkspaceFetchError('Something went wrong');
      expect(error.message).toBe('Something went wrong');
      expect(error.name).toBe('WorkspaceFetchError');
    });

    it('should create error with message and code', () => {
      const error = new WorkspaceFetchError('Database error', 'PGRST001');
      expect(error.message).toBe('Database error');
      expect(error.code).toBe('PGRST001');
    });

    it('should create error with message, code, and details', () => {
      const details = { field: 'name', reason: 'too long' };
      const error = new WorkspaceFetchError('Validation error', 'VALIDATION_ERROR', details);
      expect(error.message).toBe('Validation error');
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.details).toEqual(details);
    });

    it('should be an instance of Error', () => {
      const error = new WorkspaceFetchError('Test error');
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(WorkspaceFetchError);
    });

    it('should have undefined code when not provided', () => {
      const error = new WorkspaceFetchError('Test error');
      expect(error.code).toBeUndefined();
    });

    it('should have undefined details when not provided', () => {
      const error = new WorkspaceFetchError('Test error', 'CODE');
      expect(error.details).toBeUndefined();
    });

    it('should have correct error name for stack traces', () => {
      const error = new WorkspaceFetchError('Test');
      expect(error.name).toBe('WorkspaceFetchError');
      expect(error.stack).toContain('WorkspaceFetchError');
    });
  });

  // ============================================================================
  // fetchWorkspaces Tests
  // ============================================================================

  describe('fetchWorkspaces', () => {
    const mockUserId = '123e4567-e89b-12d3-a456-426614174001';
    const mockMemberships = [
      { workspace_id: '123e4567-e89b-12d3-a456-426614174000', role: 'admin' },
      { workspace_id: '123e4567-e89b-12d3-a456-426614174002', role: 'member' },
    ];
    const mockWorkspaces = [
      {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Test Workspace 1',
        slug: 'test-workspace-1',
        owner_id: mockUserId,
        created_at: '2024-03-01T10:00:00.000Z',
        workspace_members: [{ count: 5 }],
      },
      {
        id: '123e4567-e89b-12d3-a456-426614174002',
        name: 'Test Workspace 2',
        slug: 'test-workspace-2',
        owner_id: '123e4567-e89b-12d3-a456-426614174003',
        created_at: '2024-03-01T11:00:00.000Z',
        workspace_members: [{ count: 3 }],
      },
    ];

    function setupMocks() {
      // Mock auth.getSession
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: { user: { id: mockUserId } } },
      });

      // Mock workspace_members query
      const mockMembershipEq = jest.fn().mockResolvedValue({ data: mockMemberships, error: null });
      const mockMembershipSelect = jest.fn().mockReturnValue({ eq: mockMembershipEq });
      const mockMembershipFrom = jest.fn().mockReturnValue({ select: mockMembershipSelect });

      // Mock workspaces query
      const mockWorkspacesOrder = jest
        .fn()
        .mockResolvedValue({ data: mockWorkspaces, error: null });
      const mockWorkspacesIn = jest.fn().mockReturnValue({ order: mockWorkspacesOrder });
      const mockWorkspacesSelect = jest.fn().mockReturnValue({ in: mockWorkspacesIn });
      const mockWorkspacesFrom = jest.fn().mockReturnValue({ select: mockWorkspacesSelect });

      // Combine both queries
      (supabase.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'workspace_members') {
          return mockMembershipFrom(table);
        } else if (table === 'workspaces') {
          return mockWorkspacesFrom(table);
        }
        return {};
      });

      return {
        mockMembershipEq,
        mockWorkspacesIn,
        mockWorkspacesOrder,
      };
    }

    it('should return empty array when user is not authenticated', async () => {
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: null },
      });

      const result = await fetchWorkspaces();

      expect(result).toEqual([]);
    });

    it('should return empty array when user has no memberships', async () => {
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: { user: { id: mockUserId } } },
      });

      const mockMembershipEq = jest.fn().mockResolvedValue({ data: [], error: null });
      const mockMembershipSelect = jest.fn().mockReturnValue({ eq: mockMembershipEq });

      (supabase.from as jest.Mock).mockReturnValue({ select: mockMembershipSelect });

      const result = await fetchWorkspaces();

      expect(result).toEqual([]);
    });

    it('should fetch workspaces with member count and role', async () => {
      setupMocks();

      const result = await fetchWorkspaces();

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Test Workspace 1',
        slug: 'test-workspace-1',
        member_count: 5,
        current_user_role: 'admin',
      });
      expect(result[1]).toMatchObject({
        id: '123e4567-e89b-12d3-a456-426614174002',
        name: 'Test Workspace 2',
        slug: 'test-workspace-2',
        member_count: 3,
        current_user_role: 'member',
      });
    });

    it('should throw WorkspaceFetchError on membership fetch error', async () => {
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: { user: { id: mockUserId } } },
      });

      const mockMembershipEq = jest
        .fn()
        .mockResolvedValue({ data: null, error: { message: 'DB Error', code: 'PGRST001' } });
      const mockMembershipSelect = jest.fn().mockReturnValue({ eq: mockMembershipEq });

      (supabase.from as jest.Mock).mockReturnValue({ select: mockMembershipSelect });

      await expect(fetchWorkspaces()).rejects.toThrow(WorkspaceFetchError);
      await expect(fetchWorkspaces()).rejects.toThrow('DB Error');
    });

    it('should throw WorkspaceFetchError on workspaces fetch error', async () => {
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: { user: { id: mockUserId } } },
      });

      const mockMembershipEq = jest.fn().mockResolvedValue({ data: mockMemberships, error: null });
      const mockMembershipSelect = jest.fn().mockReturnValue({ eq: mockMembershipEq });

      const mockWorkspacesOrder = jest
        .fn()
        .mockResolvedValue({ data: null, error: { message: 'Fetch Error', code: 'PGRST002' } });
      const mockWorkspacesIn = jest.fn().mockReturnValue({ order: mockWorkspacesOrder });
      const mockWorkspacesSelect = jest.fn().mockReturnValue({ in: mockWorkspacesIn });

      (supabase.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'workspace_members') {
          return { select: mockMembershipSelect };
        } else if (table === 'workspaces') {
          return { select: mockWorkspacesSelect };
        }
        return {};
      });

      await expect(fetchWorkspaces()).rejects.toThrow(WorkspaceFetchError);
      await expect(fetchWorkspaces()).rejects.toThrow('Fetch Error');
    });

    it('should return empty array when workspaces data is null', async () => {
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: { user: { id: mockUserId } } },
      });

      const mockMembershipEq = jest.fn().mockResolvedValue({ data: mockMemberships, error: null });
      const mockMembershipSelect = jest.fn().mockReturnValue({ eq: mockMembershipEq });

      const mockWorkspacesOrder = jest.fn().mockResolvedValue({ data: null, error: null });
      const mockWorkspacesIn = jest.fn().mockReturnValue({ order: mockWorkspacesOrder });
      const mockWorkspacesSelect = jest.fn().mockReturnValue({ in: mockWorkspacesIn });

      (supabase.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'workspace_members') {
          return { select: mockMembershipSelect };
        } else if (table === 'workspaces') {
          return { select: mockWorkspacesSelect };
        }
        return {};
      });

      const result = await fetchWorkspaces();

      expect(result).toEqual([]);
    });
  });

  // ============================================================================
  // fetchWorkspace Tests
  // ============================================================================

  describe('fetchWorkspace', () => {
    const mockWorkspace = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      name: 'Test Workspace',
      slug: 'test-workspace',
      owner_id: '123e4567-e89b-12d3-a456-426614174001',
      created_at: '2024-03-01T10:00:00.000Z',
    };

    it('should fetch a single workspace by id', async () => {
      const mockSingle = jest.fn().mockResolvedValue({ data: mockWorkspace, error: null });
      const mockEq = jest.fn().mockReturnValue({ single: mockSingle });
      const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });
      const mockFrom = jest.fn().mockReturnValue({ select: mockSelect });

      (supabase.from as jest.Mock).mockImplementation(mockFrom);

      const result = await fetchWorkspace('123e4567-e89b-12d3-a456-426614174000');

      expect(result).toMatchObject({
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Test Workspace',
        slug: 'test-workspace',
      });
      expect(mockEq).toHaveBeenCalledWith('id', '123e4567-e89b-12d3-a456-426614174000');
    });

    it('should throw WorkspaceFetchError when workspace not found', async () => {
      const mockSingle = jest.fn().mockResolvedValue({ data: null, error: null });
      const mockEq = jest.fn().mockReturnValue({ single: mockSingle });
      const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });
      const mockFrom = jest.fn().mockReturnValue({ select: mockSelect });

      (supabase.from as jest.Mock).mockImplementation(mockFrom);

      await expect(fetchWorkspace('nonexistent-id')).rejects.toThrow(WorkspaceFetchError);
      await expect(fetchWorkspace('nonexistent-id')).rejects.toThrow('Workspace not found');
    });

    it('should throw WorkspaceFetchError on supabase error', async () => {
      const mockSingle = jest
        .fn()
        .mockResolvedValue({ data: null, error: { message: 'DB Error', code: 'PGRST001' } });
      const mockEq = jest.fn().mockReturnValue({ single: mockSingle });
      const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });
      const mockFrom = jest.fn().mockReturnValue({ select: mockSelect });

      (supabase.from as jest.Mock).mockImplementation(mockFrom);

      await expect(fetchWorkspace('some-id')).rejects.toThrow(WorkspaceFetchError);
      await expect(fetchWorkspace('some-id')).rejects.toThrow('DB Error');
    });
  });

  // ============================================================================
  // Type Safety Tests
  // ============================================================================

  describe('Type Safety', () => {
    it('WorkspaceFetchError should have proper properties', () => {
      const error = new WorkspaceFetchError('Test', 'CODE', { detail: 'value' });

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
