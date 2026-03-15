/**
 * Approval Hooks Tests
 *
 * Tests for the approval React Query hooks - specifically the non-hook exports
 * and utilities that can be tested directly.
 *
 * Tests:
 * - ApprovalFetchError class
 * - Query key generation
 * - fetchPendingApprovals
 * - fetchMySubmissions
 * - fetchApprovalAssignments
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
    pendingApprovals: (workspaceId: string) => ['approvals', 'pending', workspaceId] as const,
    mySubmissions: (workspaceId: string) => ['approvals', 'submissions', workspaceId] as const,
    approvalAssignments: (workspaceId: string) => ['approvalAssignments', workspaceId] as const,
  },
}));

// Now import the module under test
import {
  ApprovalFetchError,
  fetchPendingApprovals,
  fetchMySubmissions,
  fetchApprovalAssignments,
} from '@/hooks/useApprovals';
import { queryKeys } from '@/lib/queryClient';
import { supabase } from '@/lib/supabase';

describe('Approval Hooks Utilities', () => {
  // Reset mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================================
  // Query Keys Tests
  // ============================================================================

  describe('queryKeys', () => {
    it('should generate correct pendingApprovals key with workspace id', () => {
      const workspaceId = '123e4567-e89b-12d3-a456-426614174000';
      expect(queryKeys.pendingApprovals(workspaceId)).toEqual([
        'approvals',
        'pending',
        workspaceId,
      ]);
    });

    it('should generate correct mySubmissions key with workspace id', () => {
      const workspaceId = '123e4567-e89b-12d3-a456-426614174000';
      expect(queryKeys.mySubmissions(workspaceId)).toEqual([
        'approvals',
        'submissions',
        workspaceId,
      ]);
    });

    it('should generate correct approvalAssignments key with workspace id', () => {
      const workspaceId = '123e4567-e89b-12d3-a456-426614174000';
      expect(queryKeys.approvalAssignments(workspaceId)).toEqual([
        'approvalAssignments',
        workspaceId,
      ]);
    });

    it('should generate unique keys for different workspace ids', () => {
      const id1 = '123e4567-e89b-12d3-a456-426614174000';
      const id2 = '123e4567-e89b-12d3-a456-426614174001';

      const key1 = queryKeys.pendingApprovals(id1);
      const key2 = queryKeys.pendingApprovals(id2);

      expect(key1).not.toEqual(key2);
      expect(key1[0]).toEqual(key2[0]); // Same prefix
      expect(key1[2]).not.toEqual(key2[2]); // Different workspace IDs
    });
  });

  // ============================================================================
  // ApprovalFetchError Tests
  // ============================================================================

  describe('ApprovalFetchError', () => {
    it('should create error with message', () => {
      const error = new ApprovalFetchError('Something went wrong');
      expect(error.message).toBe('Something went wrong');
      expect(error.name).toBe('ApprovalFetchError');
    });

    it('should create error with message and code', () => {
      const error = new ApprovalFetchError('Database error', 'PGRST001');
      expect(error.message).toBe('Database error');
      expect(error.code).toBe('PGRST001');
    });

    it('should create error with message, code, and details', () => {
      const details = { field: 'status', reason: 'invalid value' };
      const error = new ApprovalFetchError('Validation error', 'VALIDATION_ERROR', details);
      expect(error.message).toBe('Validation error');
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.details).toEqual(details);
    });

    it('should be an instance of Error', () => {
      const error = new ApprovalFetchError('Test error');
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ApprovalFetchError);
    });

    it('should have undefined code when not provided', () => {
      const error = new ApprovalFetchError('Test error');
      expect(error.code).toBeUndefined();
    });

    it('should have undefined details when not provided', () => {
      const error = new ApprovalFetchError('Test error', 'CODE');
      expect(error.details).toBeUndefined();
    });

    it('should have correct error name for stack traces', () => {
      const error = new ApprovalFetchError('Test');
      expect(error.name).toBe('ApprovalFetchError');
      expect(error.stack).toContain('ApprovalFetchError');
    });
  });

  // ============================================================================
  // fetchPendingApprovals Tests
  // ============================================================================

  describe('fetchPendingApprovals', () => {
    const mockUserId = '123e4567-e89b-12d3-a456-426614174001';
    const mockWorkspaceId = '123e4567-e89b-12d3-a456-426614174000';
    const mockProjectId = '123e4567-e89b-12d3-a456-426614174010';

    it('should return empty array when user is not authenticated', async () => {
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: null },
      });

      const result = await fetchPendingApprovals(mockWorkspaceId);

      expect(result).toEqual([]);
    });

    it('should return empty array when workspace has no projects', async () => {
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: { user: { id: mockUserId } } },
      });

      const mockProjectsEq = jest.fn().mockResolvedValue({ data: [], error: null });
      const mockProjectsSelect = jest.fn().mockReturnValue({ eq: mockProjectsEq });

      (supabase.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'projects') {
          return { select: mockProjectsSelect };
        }
        return {};
      });

      const result = await fetchPendingApprovals(mockWorkspaceId);

      expect(result).toEqual([]);
    });

    it('should throw ApprovalFetchError on supabase error', async () => {
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: { user: { id: mockUserId } } },
      });

      const mockProjectsEq = jest
        .fn()
        .mockResolvedValue({ data: [{ id: mockProjectId }], error: null });
      const mockProjectsSelect = jest.fn().mockReturnValue({ eq: mockProjectsEq });

      const mockEntriesOrder = jest.fn().mockResolvedValue({
        data: null,
        error: { message: 'DB Error', code: 'PGRST001' },
      });
      const mockEntriesIn = jest.fn().mockReturnValue({ order: mockEntriesOrder });
      const mockEntriesEq2 = jest.fn().mockReturnValue({ in: mockEntriesIn });
      const mockEntriesEq = jest.fn().mockReturnValue({ eq: mockEntriesEq2 });
      const mockEntriesSelect = jest.fn().mockReturnValue({ eq: mockEntriesEq });

      (supabase.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'projects') {
          return { select: mockProjectsSelect };
        } else if (table === 'time_entries') {
          return { select: mockEntriesSelect };
        }
        return {};
      });

      await expect(fetchPendingApprovals(mockWorkspaceId)).rejects.toThrow(ApprovalFetchError);
      await expect(fetchPendingApprovals(mockWorkspaceId)).rejects.toThrow('DB Error');
    });

    it('should return empty array when no data is returned', async () => {
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: { user: { id: mockUserId } } },
      });

      const mockProjectsEq = jest
        .fn()
        .mockResolvedValue({ data: [{ id: mockProjectId }], error: null });
      const mockProjectsSelect = jest.fn().mockReturnValue({ eq: mockProjectsEq });

      const mockEntriesOrder = jest.fn().mockResolvedValue({ data: null, error: null });
      const mockEntriesIn = jest.fn().mockReturnValue({ order: mockEntriesOrder });
      const mockEntriesEq2 = jest.fn().mockReturnValue({ in: mockEntriesIn });
      const mockEntriesEq = jest.fn().mockReturnValue({ eq: mockEntriesEq2 });
      const mockEntriesSelect = jest.fn().mockReturnValue({ eq: mockEntriesEq });

      (supabase.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'projects') {
          return { select: mockProjectsSelect };
        } else if (table === 'time_entries') {
          return { select: mockEntriesSelect };
        }
        return {};
      });

      const result = await fetchPendingApprovals(mockWorkspaceId);

      expect(result).toEqual([]);
    });
  });

  // ============================================================================
  // fetchMySubmissions Tests
  // ============================================================================

  describe('fetchMySubmissions', () => {
    const mockUserId = '123e4567-e89b-12d3-a456-426614174001';
    const mockWorkspaceId = '123e4567-e89b-12d3-a456-426614174000';
    const mockProjectId = '123e4567-e89b-12d3-a456-426614174010';

    it('should return empty array when user is not authenticated', async () => {
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: null },
      });

      const result = await fetchMySubmissions(mockWorkspaceId);

      expect(result).toEqual([]);
    });

    it('should return empty array when workspace has no projects', async () => {
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: { user: { id: mockUserId } } },
      });

      const mockProjectsEq = jest.fn().mockResolvedValue({ data: [], error: null });
      const mockProjectsSelect = jest.fn().mockReturnValue({ eq: mockProjectsEq });

      (supabase.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'projects') {
          return { select: mockProjectsSelect };
        }
        return {};
      });

      const result = await fetchMySubmissions(mockWorkspaceId);

      expect(result).toEqual([]);
    });

    it('should throw ApprovalFetchError on supabase error', async () => {
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: { user: { id: mockUserId } } },
      });

      const mockProjectsEq = jest
        .fn()
        .mockResolvedValue({ data: [{ id: mockProjectId }], error: null });
      const mockProjectsSelect = jest.fn().mockReturnValue({ eq: mockProjectsEq });

      const mockEntriesOrder = jest.fn().mockResolvedValue({
        data: null,
        error: { message: 'DB Error', code: 'PGRST001' },
      });
      const mockEntriesIn2 = jest.fn().mockReturnValue({ order: mockEntriesOrder });
      const mockEntriesIn = jest.fn().mockReturnValue({ in: mockEntriesIn2 });
      const mockEntriesEq = jest.fn().mockReturnValue({ in: mockEntriesIn });
      const mockEntriesSelect = jest.fn().mockReturnValue({ eq: mockEntriesEq });

      (supabase.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'projects') {
          return { select: mockProjectsSelect };
        } else if (table === 'time_entries') {
          return { select: mockEntriesSelect };
        }
        return {};
      });

      await expect(fetchMySubmissions(mockWorkspaceId)).rejects.toThrow(ApprovalFetchError);
      await expect(fetchMySubmissions(mockWorkspaceId)).rejects.toThrow('DB Error');
    });

    it('should filter by custom statuses when provided', async () => {
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: { user: { id: mockUserId } } },
      });

      const mockProjectsEq = jest
        .fn()
        .mockResolvedValue({ data: [{ id: mockProjectId }], error: null });
      const mockProjectsSelect = jest.fn().mockReturnValue({ eq: mockProjectsEq });

      const mockEntriesOrder = jest.fn().mockResolvedValue({ data: [], error: null });
      const mockEntriesIn2 = jest.fn().mockReturnValue({ order: mockEntriesOrder });
      const mockEntriesIn = jest.fn().mockReturnValue({ in: mockEntriesIn2 });
      const mockEntriesEq = jest.fn().mockReturnValue({ in: mockEntriesIn });
      const mockEntriesSelect = jest.fn().mockReturnValue({ eq: mockEntriesEq });

      (supabase.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'projects') {
          return { select: mockProjectsSelect };
        } else if (table === 'time_entries') {
          return { select: mockEntriesSelect };
        }
        return {};
      });

      await fetchMySubmissions(mockWorkspaceId, ['submitted']);

      // Verify the filter was applied
      expect(mockEntriesIn).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // fetchApprovalAssignments Tests
  // ============================================================================

  describe('fetchApprovalAssignments', () => {
    const mockWorkspaceId = '123e4567-e89b-12d3-a456-426614174000';
    const mockAssignments = [
      {
        id: '123e4567-e89b-12d3-a456-426614174020',
        workspace_id: mockWorkspaceId,
        member_user_id: '123e4567-e89b-12d3-a456-426614174001',
        approver_user_id: '123e4567-e89b-12d3-a456-426614174002',
        created_by: '123e4567-e89b-12d3-a456-426614174003',
        created_at: '2024-03-01T10:00:00.000Z',
        member: {
          id: '123e4567-e89b-12d3-a456-426614174001',
          email: 'member@example.com',
          name: 'Member User',
        },
        approver: {
          id: '123e4567-e89b-12d3-a456-426614174002',
          email: 'approver@example.com',
          name: 'Approver User',
        },
      },
    ];

    it('should fetch approval assignments for a workspace', async () => {
      const mockOrder = jest.fn().mockResolvedValue({ data: mockAssignments, error: null });
      const mockEq = jest.fn().mockReturnValue({ order: mockOrder });
      const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });

      (supabase.from as jest.Mock).mockReturnValue({ select: mockSelect });

      const result = await fetchApprovalAssignments(mockWorkspaceId);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: '123e4567-e89b-12d3-a456-426614174020',
        workspace_id: mockWorkspaceId,
        member: {
          email: 'member@example.com',
          name: 'Member User',
        },
        approver: {
          email: 'approver@example.com',
          name: 'Approver User',
        },
      });
      expect(mockEq).toHaveBeenCalledWith('workspace_id', mockWorkspaceId);
    });

    it('should throw ApprovalFetchError on supabase error', async () => {
      const mockOrder = jest.fn().mockResolvedValue({
        data: null,
        error: { message: 'DB Error', code: 'PGRST001' },
      });
      const mockEq = jest.fn().mockReturnValue({ order: mockOrder });
      const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });

      (supabase.from as jest.Mock).mockReturnValue({ select: mockSelect });

      await expect(fetchApprovalAssignments(mockWorkspaceId)).rejects.toThrow(ApprovalFetchError);
      await expect(fetchApprovalAssignments(mockWorkspaceId)).rejects.toThrow('DB Error');
    });

    it('should return empty array when no data is returned', async () => {
      const mockOrder = jest.fn().mockResolvedValue({ data: null, error: null });
      const mockEq = jest.fn().mockReturnValue({ order: mockOrder });
      const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });

      (supabase.from as jest.Mock).mockReturnValue({ select: mockSelect });

      const result = await fetchApprovalAssignments(mockWorkspaceId);

      expect(result).toEqual([]);
    });

    it('should skip assignments with missing member or approver data', async () => {
      const incompleteAssignments = [
        {
          ...mockAssignments[0],
          member: null, // Missing member
        },
      ];

      const mockOrder = jest.fn().mockResolvedValue({ data: incompleteAssignments, error: null });
      const mockEq = jest.fn().mockReturnValue({ order: mockOrder });
      const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });

      (supabase.from as jest.Mock).mockReturnValue({ select: mockSelect });

      const result = await fetchApprovalAssignments(mockWorkspaceId);

      // Should skip the assignment with missing member
      expect(result).toEqual([]);
    });
  });

  // ============================================================================
  // Type Safety Tests
  // ============================================================================

  describe('Type Safety', () => {
    it('ApprovalFetchError should have proper properties', () => {
      const error = new ApprovalFetchError('Test', 'CODE', { detail: 'value' });

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
