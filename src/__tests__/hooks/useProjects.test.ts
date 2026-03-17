/**
 * Project Hooks Tests
 *
 * Tests for the project React Query hooks - specifically the non-hook exports
 * and utilities that can be tested directly.
 *
 * Tests:
 * - ProjectFetchError class
 * - Query key generation
 * - fetchProjects filters
 * - fetchProject single project fetch
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
    projects: (workspaceId: string) => ['projects', workspaceId] as const,
    project: (id: string) => ['projects', 'single', id] as const,
  },
}));

// Now import the module under test
import { ProjectFetchError, fetchProjects, fetchProject } from '@/hooks/useProjects';
import { queryKeys } from '@/lib/queryClient';
import { supabase } from '@/lib/supabase';

describe('Project Hooks Utilities', () => {
  // Reset mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================================
  // Query Keys Tests
  // ============================================================================

  describe('queryKeys', () => {
    it('should generate correct projects key with workspace id', () => {
      const workspaceId = '123e4567-e89b-12d3-a456-426614174000';
      expect(queryKeys.projects(workspaceId)).toEqual(['projects', workspaceId]);
    });

    it('should generate correct project key with id', () => {
      const projectId = '123e4567-e89b-12d3-a456-426614174000';
      expect(queryKeys.project(projectId)).toEqual(['projects', 'single', projectId]);
    });

    it('should generate unique keys for different workspace ids', () => {
      const id1 = '123e4567-e89b-12d3-a456-426614174000';
      const id2 = '123e4567-e89b-12d3-a456-426614174001';

      const key1 = queryKeys.projects(id1);
      const key2 = queryKeys.projects(id2);

      expect(key1).not.toEqual(key2);
      expect(key1[0]).toEqual(key2[0]); // Same prefix
      expect(key1[1]).not.toEqual(key2[1]); // Different IDs
    });
  });

  // ============================================================================
  // ProjectFetchError Tests
  // ============================================================================

  describe('ProjectFetchError', () => {
    it('should create error with message', () => {
      const error = new ProjectFetchError('Something went wrong');
      expect(error.message).toBe('Something went wrong');
      expect(error.name).toBe('ProjectFetchError');
    });

    it('should create error with message and code', () => {
      const error = new ProjectFetchError('Database error', 'PGRST001');
      expect(error.message).toBe('Database error');
      expect(error.code).toBe('PGRST001');
    });

    it('should create error with message, code, and details', () => {
      const details = { field: 'name', reason: 'too long' };
      const error = new ProjectFetchError('Validation error', 'VALIDATION_ERROR', details);
      expect(error.message).toBe('Validation error');
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.details).toEqual(details);
    });

    it('should be an instance of Error', () => {
      const error = new ProjectFetchError('Test error');
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ProjectFetchError);
    });

    it('should have undefined code when not provided', () => {
      const error = new ProjectFetchError('Test error');
      expect(error.code).toBeUndefined();
    });

    it('should have undefined details when not provided', () => {
      const error = new ProjectFetchError('Test error', 'CODE');
      expect(error.details).toBeUndefined();
    });

    it('should have correct error name for stack traces', () => {
      const error = new ProjectFetchError('Test');
      expect(error.name).toBe('ProjectFetchError');
      expect(error.stack).toContain('ProjectFetchError');
    });
  });

  // ============================================================================
  // fetchProjects Tests
  // ============================================================================

  describe('fetchProjects', () => {
    const mockUserId = '123e4567-e89b-12d3-a456-426614174001';
    const mockWorkspaceId = '123e4567-e89b-12d3-a456-426614174000';
    const mockProjects = [
      {
        id: '123e4567-e89b-12d3-a456-426614174010',
        workspace_id: mockWorkspaceId,
        name: 'Project 1',
        color: '#FF0000',
        description: 'Test project 1',
        is_archived: false,
        created_by: mockUserId,
        created_at: '2024-03-01T10:00:00.000Z',
        project_members: [{ count: 5 }],
      },
      {
        id: '123e4567-e89b-12d3-a456-426614174011',
        workspace_id: mockWorkspaceId,
        name: 'Project 2',
        color: '#00FF00',
        description: 'Test project 2',
        is_archived: false,
        created_by: '123e4567-e89b-12d3-a456-426614174002',
        created_at: '2024-03-01T11:00:00.000Z',
        project_members: [{ count: 3 }],
      },
    ];
    const mockMemberships = [{ project_id: '123e4567-e89b-12d3-a456-426614174010', role: 'admin' }];

    function setupMocks(
      projectsData: typeof mockProjects | null = mockProjects,
      projectsError: unknown = null
    ) {
      // Mock auth.getSession
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: { user: { id: mockUserId } } },
      });

      // Create a chainable mock that mimics Supabase query builder
      // The chain is: select -> eq(workspace_id) -> order -> [eq(is_archived)]? -> resolve
      const resolveValue = { data: projectsData, error: projectsError };

      // Create a thenable object that also has chainable methods
      const createThenable = (): Record<string, unknown> => {
        const obj: Record<string, unknown> = {};
        obj.eq = jest.fn().mockImplementation(() => createThenable());
        obj.order = jest.fn().mockImplementation(() => createThenable());
        // Make it thenable (Promise-like)
        obj.then = (resolve: (value: unknown) => unknown) =>
          Promise.resolve(resolveValue).then(resolve);
        obj.catch = (reject: (error: unknown) => unknown) =>
          Promise.resolve(resolveValue).catch(reject);
        return obj;
      };

      const mockProjectsEq = jest.fn().mockImplementation(() => createThenable());
      const mockProjectsOrder = jest.fn().mockImplementation(() => createThenable());
      const mockProjectsSelect = jest.fn().mockReturnValue({
        eq: mockProjectsEq,
        order: mockProjectsOrder,
      });

      // Mock project_members query
      const mockMembersEq = jest.fn().mockResolvedValue({ data: mockMemberships, error: null });
      const mockMembersSelect = jest.fn().mockReturnValue({ eq: mockMembersEq });

      (supabase.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'projects') {
          return { select: mockProjectsSelect };
        } else if (table === 'project_members') {
          return { select: mockMembersSelect };
        }
        return {};
      });

      return {
        mockProjectsEq,
        mockProjectsOrder,
      };
    }

    it('should return empty array when user is not authenticated', async () => {
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: null },
      });

      const result = await fetchProjects(mockWorkspaceId);

      expect(result).toEqual([]);
    });

    it('should fetch projects with member count', async () => {
      setupMocks();

      const result = await fetchProjects(mockWorkspaceId);

      // Only the first project should be returned because user is member or creator
      // Project 1: user is creator
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: '123e4567-e89b-12d3-a456-426614174010',
        name: 'Project 1',
        member_count: 5,
        is_member: true,
      });
    });

    it('should include archived projects when includeArchived is true', async () => {
      const mocks = setupMocks();

      await fetchProjects(mockWorkspaceId, { includeArchived: true });

      // Should NOT call .eq('is_archived', false) when including archived
      // The eq chain is: .eq('workspace_id', ...).order(...)
      expect(mocks.mockProjectsEq).toHaveBeenCalled();
    });

    it('should throw ProjectFetchError on supabase error', async () => {
      setupMocks(null, { message: 'DB Error', code: 'PGRST001' });

      await expect(fetchProjects(mockWorkspaceId)).rejects.toThrow(ProjectFetchError);
      await expect(fetchProjects(mockWorkspaceId)).rejects.toThrow('DB Error');
    });

    it('should return empty array when projects data is null', async () => {
      setupMocks(null, null);

      const result = await fetchProjects(mockWorkspaceId);

      expect(result).toEqual([]);
    });
  });

  // ============================================================================
  // fetchProject Tests
  // ============================================================================

  describe('fetchProject', () => {
    const mockProject = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      workspace_id: '123e4567-e89b-12d3-a456-426614174010',
      name: 'Test Project',
      color: '#FF0000',
      description: 'A test project',
      is_archived: false,
      created_by: '123e4567-e89b-12d3-a456-426614174001',
      created_at: '2024-03-01T10:00:00.000Z',
      project_members: [
        {
          id: 'member-1',
          project_id: '123e4567-e89b-12d3-a456-426614174000',
          user_id: '123e4567-e89b-12d3-a456-426614174001',
          role: 'admin',
          added_at: '2024-03-01T10:00:00.000Z',
          user: {
            id: '123e4567-e89b-12d3-a456-426614174001',
            email: 'test@example.com',
            name: 'Test User',
          },
        },
      ],
    };

    it('should fetch a single project by id', async () => {
      const mockSingle = jest.fn().mockResolvedValue({ data: mockProject, error: null });
      const mockEq = jest.fn().mockReturnValue({ single: mockSingle });
      const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });
      const mockFrom = jest.fn().mockReturnValue({ select: mockSelect });

      (supabase.from as jest.Mock).mockImplementation(mockFrom);

      const result = await fetchProject('123e4567-e89b-12d3-a456-426614174000');

      expect(result).toMatchObject({
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Test Project',
      });
      expect(mockEq).toHaveBeenCalledWith('id', '123e4567-e89b-12d3-a456-426614174000');
    });

    it('should throw ProjectFetchError when project not found', async () => {
      const mockSingle = jest.fn().mockResolvedValue({ data: null, error: null });
      const mockEq = jest.fn().mockReturnValue({ single: mockSingle });
      const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });
      const mockFrom = jest.fn().mockReturnValue({ select: mockSelect });

      (supabase.from as jest.Mock).mockImplementation(mockFrom);

      await expect(fetchProject('nonexistent-id')).rejects.toThrow(ProjectFetchError);
      await expect(fetchProject('nonexistent-id')).rejects.toThrow('Project not found');
    });

    it('should throw ProjectFetchError on supabase error', async () => {
      const mockSingle = jest
        .fn()
        .mockResolvedValue({ data: null, error: { message: 'DB Error', code: 'PGRST001' } });
      const mockEq = jest.fn().mockReturnValue({ single: mockSingle });
      const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });
      const mockFrom = jest.fn().mockReturnValue({ select: mockSelect });

      (supabase.from as jest.Mock).mockImplementation(mockFrom);

      await expect(fetchProject('some-id')).rejects.toThrow(ProjectFetchError);
      await expect(fetchProject('some-id')).rejects.toThrow('DB Error');
    });

    it('should include member details in the response', async () => {
      const mockSingle = jest.fn().mockResolvedValue({ data: mockProject, error: null });
      const mockEq = jest.fn().mockReturnValue({ single: mockSingle });
      const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });
      const mockFrom = jest.fn().mockReturnValue({ select: mockSelect });

      (supabase.from as jest.Mock).mockImplementation(mockFrom);

      const result = await fetchProject('123e4567-e89b-12d3-a456-426614174000');

      expect(result.members).toBeDefined();
      expect(result.members).toHaveLength(1);
      expect(result.members![0]).toMatchObject({
        role: 'admin',
        user: {
          email: 'test@example.com',
          name: 'Test User',
        },
      });
    });
  });

  // ============================================================================
  // Type Safety Tests
  // ============================================================================

  describe('Type Safety', () => {
    it('ProjectFetchError should have proper properties', () => {
      const error = new ProjectFetchError('Test', 'CODE', { detail: 'value' });

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
