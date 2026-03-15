/**
 * Approval Schema Tests
 *
 * Tests all approval Zod schemas with valid and invalid inputs.
 * Tests ApprovalStatusEnum, ApprovalAssignmentSchema, TimeEntryWithApprovalSchema,
 * CreateApprovalAssignmentSchema, SubmitEntriesInputSchema, RejectEntriesInputSchema, etc.
 */

import {
  ApprovalStatusEnum,
  ApprovalAssignmentSchema,
  ApprovalAssignmentWithUsersSchema,
  TimeEntryWithApprovalSchema,
  // TimeEntryWithApprovalAndUserSchema, // TODO: Add tests for this schema
  ApprovalSummarySchema,
  CreateApprovalAssignmentSchema,
  SubmitEntriesInputSchema,
  ApproveEntriesInputSchema,
  RejectEntriesInputSchema,
  ApprovalFilterSchema,
} from '@/schemas/approval';

describe('Approval Schemas', () => {
  // ============================================================================
  // ApprovalStatusEnum Tests
  // ============================================================================

  describe('ApprovalStatusEnum', () => {
    it('should accept valid approval status values', () => {
      expect(ApprovalStatusEnum.safeParse('draft').success).toBe(true);
      expect(ApprovalStatusEnum.safeParse('submitted').success).toBe(true);
      expect(ApprovalStatusEnum.safeParse('approved').success).toBe(true);
      expect(ApprovalStatusEnum.safeParse('rejected').success).toBe(true);
    });

    it('should reject invalid approval status values', () => {
      expect(ApprovalStatusEnum.safeParse('pending').success).toBe(false);
      expect(ApprovalStatusEnum.safeParse('cancelled').success).toBe(false);
      expect(ApprovalStatusEnum.safeParse('').success).toBe(false);
      expect(ApprovalStatusEnum.safeParse(null).success).toBe(false);
    });
  });

  // ============================================================================
  // ApprovalAssignmentSchema Tests
  // ============================================================================

  describe('ApprovalAssignmentSchema', () => {
    const validAssignment = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      workspace_id: '123e4567-e89b-12d3-a456-426614174001',
      member_user_id: '123e4567-e89b-12d3-a456-426614174002',
      approver_user_id: '123e4567-e89b-12d3-a456-426614174003',
      created_by: '123e4567-e89b-12d3-a456-426614174004',
      created_at: '2024-03-01T10:00:00.000Z',
    };

    it('should accept valid assignment data', () => {
      const result = ApprovalAssignmentSchema.safeParse(validAssignment);
      expect(result.success).toBe(true);
    });

    it('should require valid UUIDs for all ID fields', () => {
      expect(
        ApprovalAssignmentSchema.safeParse({ ...validAssignment, id: 'invalid' }).success
      ).toBe(false);
      expect(
        ApprovalAssignmentSchema.safeParse({ ...validAssignment, workspace_id: 'invalid' }).success
      ).toBe(false);
      expect(
        ApprovalAssignmentSchema.safeParse({ ...validAssignment, member_user_id: 'invalid' })
          .success
      ).toBe(false);
      expect(
        ApprovalAssignmentSchema.safeParse({ ...validAssignment, approver_user_id: 'invalid' })
          .success
      ).toBe(false);
      expect(
        ApprovalAssignmentSchema.safeParse({ ...validAssignment, created_by: 'invalid' }).success
      ).toBe(false);
    });

    it('should require valid datetime for created_at', () => {
      const result = ApprovalAssignmentSchema.safeParse({
        ...validAssignment,
        created_at: 'invalid-date',
      });
      expect(result.success).toBe(false);
    });

    it('should reject missing required fields', () => {
      const { member_user_id: _m, ...withoutMemberId } = validAssignment;
      expect(ApprovalAssignmentSchema.safeParse(withoutMemberId).success).toBe(false);

      const { approver_user_id: _a, ...withoutApproverId } = validAssignment;
      expect(ApprovalAssignmentSchema.safeParse(withoutApproverId).success).toBe(false);
    });
  });

  // ============================================================================
  // ApprovalAssignmentWithUsersSchema Tests
  // ============================================================================

  describe('ApprovalAssignmentWithUsersSchema', () => {
    const validAssignmentWithUsers = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      workspace_id: '123e4567-e89b-12d3-a456-426614174001',
      member_user_id: '123e4567-e89b-12d3-a456-426614174002',
      approver_user_id: '123e4567-e89b-12d3-a456-426614174003',
      created_by: '123e4567-e89b-12d3-a456-426614174004',
      created_at: '2024-03-01T10:00:00.000Z',
      member: {
        id: '123e4567-e89b-12d3-a456-426614174002',
        email: 'member@example.com',
        name: 'John Member',
      },
      approver: {
        id: '123e4567-e89b-12d3-a456-426614174003',
        email: 'approver@example.com',
        name: 'Jane Approver',
      },
    };

    it('should accept valid assignment with users data', () => {
      const result = ApprovalAssignmentWithUsersSchema.safeParse(validAssignmentWithUsers);
      expect(result.success).toBe(true);
    });

    it('should allow null names in user objects', () => {
      const result = ApprovalAssignmentWithUsersSchema.safeParse({
        ...validAssignmentWithUsers,
        member: { ...validAssignmentWithUsers.member, name: null },
        approver: { ...validAssignmentWithUsers.approver, name: null },
      });
      expect(result.success).toBe(true);
    });

    it('should require valid email in user objects', () => {
      const invalidMemberEmail = ApprovalAssignmentWithUsersSchema.safeParse({
        ...validAssignmentWithUsers,
        member: { ...validAssignmentWithUsers.member, email: 'invalid' },
      });
      expect(invalidMemberEmail.success).toBe(false);

      const invalidApproverEmail = ApprovalAssignmentWithUsersSchema.safeParse({
        ...validAssignmentWithUsers,
        approver: { ...validAssignmentWithUsers.approver, email: 'invalid' },
      });
      expect(invalidApproverEmail.success).toBe(false);
    });

    it('should require both member and approver objects', () => {
      const { member: _m, ...withoutMember } = validAssignmentWithUsers;
      expect(ApprovalAssignmentWithUsersSchema.safeParse(withoutMember).success).toBe(false);

      const { approver: _a, ...withoutApprover } = validAssignmentWithUsers;
      expect(ApprovalAssignmentWithUsersSchema.safeParse(withoutApprover).success).toBe(false);
    });
  });

  // ============================================================================
  // TimeEntryWithApprovalSchema Tests
  // ============================================================================

  describe('TimeEntryWithApprovalSchema', () => {
    const validEntry = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      user_id: '123e4567-e89b-12d3-a456-426614174001',
      category_id: '123e4567-e89b-12d3-a456-426614174002',
      start_at: '2024-03-01T09:00:00.000Z',
      end_at: '2024-03-01T10:00:00.000Z',
      duration_seconds: 3600,
      notes: 'Worked on feature X',
      entry_type: 'work',
      is_billable: true,
      created_at: '2024-03-01T09:00:00.000Z',
      updated_at: '2024-03-01T10:00:00.000Z',
      project_id: '123e4567-e89b-12d3-a456-426614174003',
      approval_status: 'draft',
      approver_id: '123e4567-e89b-12d3-a456-426614174004',
      approval_note: null,
      approved_at: null,
      submitted_at: null,
    };

    it('should accept valid time entry with approval data', () => {
      const result = TimeEntryWithApprovalSchema.safeParse(validEntry);
      expect(result.success).toBe(true);
    });

    it('should allow null for nullable fields', () => {
      const result = TimeEntryWithApprovalSchema.safeParse({
        ...validEntry,
        category_id: null,
        end_at: null,
        notes: null,
        project_id: null,
        approver_id: null,
      });
      expect(result.success).toBe(true);
    });

    it('should validate entry_type enum', () => {
      expect(
        TimeEntryWithApprovalSchema.safeParse({ ...validEntry, entry_type: 'work' }).success
      ).toBe(true);
      expect(
        TimeEntryWithApprovalSchema.safeParse({ ...validEntry, entry_type: 'break' }).success
      ).toBe(true);
      expect(
        TimeEntryWithApprovalSchema.safeParse({ ...validEntry, entry_type: 'long_break' }).success
      ).toBe(true);
      expect(
        TimeEntryWithApprovalSchema.safeParse({ ...validEntry, entry_type: 'invalid' }).success
      ).toBe(false);
    });

    it('should validate approval_status enum', () => {
      expect(
        TimeEntryWithApprovalSchema.safeParse({ ...validEntry, approval_status: 'draft' }).success
      ).toBe(true);
      expect(
        TimeEntryWithApprovalSchema.safeParse({ ...validEntry, approval_status: 'submitted' })
          .success
      ).toBe(true);
      expect(
        TimeEntryWithApprovalSchema.safeParse({ ...validEntry, approval_status: 'approved' })
          .success
      ).toBe(true);
      expect(
        TimeEntryWithApprovalSchema.safeParse({ ...validEntry, approval_status: 'rejected' })
          .success
      ).toBe(true);
      expect(
        TimeEntryWithApprovalSchema.safeParse({ ...validEntry, approval_status: 'pending' }).success
      ).toBe(false);
    });

    it('should validate approval_note max length (500)', () => {
      const maxNote = 'a'.repeat(500);
      expect(
        TimeEntryWithApprovalSchema.safeParse({ ...validEntry, approval_note: maxNote }).success
      ).toBe(true);

      const tooLongNote = 'a'.repeat(501);
      expect(
        TimeEntryWithApprovalSchema.safeParse({ ...validEntry, approval_note: tooLongNote }).success
      ).toBe(false);
    });

    it('should require non-negative duration_seconds', () => {
      expect(
        TimeEntryWithApprovalSchema.safeParse({ ...validEntry, duration_seconds: 0 }).success
      ).toBe(true);
      expect(
        TimeEntryWithApprovalSchema.safeParse({ ...validEntry, duration_seconds: -1 }).success
      ).toBe(false);
    });
  });

  // ============================================================================
  // ApprovalSummarySchema Tests
  // ============================================================================

  describe('ApprovalSummarySchema', () => {
    const validSummary = {
      pending_count: 5,
      submitted_count: 3,
      approved_count: 10,
      rejected_count: 2,
    };

    it('should accept valid summary data', () => {
      const result = ApprovalSummarySchema.safeParse(validSummary);
      expect(result.success).toBe(true);
    });

    it('should accept all zeros', () => {
      const result = ApprovalSummarySchema.safeParse({
        pending_count: 0,
        submitted_count: 0,
        approved_count: 0,
        rejected_count: 0,
      });
      expect(result.success).toBe(true);
    });

    it('should reject negative counts', () => {
      expect(ApprovalSummarySchema.safeParse({ ...validSummary, pending_count: -1 }).success).toBe(
        false
      );
      expect(
        ApprovalSummarySchema.safeParse({ ...validSummary, submitted_count: -1 }).success
      ).toBe(false);
      expect(ApprovalSummarySchema.safeParse({ ...validSummary, approved_count: -1 }).success).toBe(
        false
      );
      expect(ApprovalSummarySchema.safeParse({ ...validSummary, rejected_count: -1 }).success).toBe(
        false
      );
    });

    it('should require all count fields', () => {
      const { pending_count: _p, ...withoutPending } = validSummary;
      expect(ApprovalSummarySchema.safeParse(withoutPending).success).toBe(false);
    });
  });

  // ============================================================================
  // CreateApprovalAssignmentSchema Tests
  // ============================================================================

  describe('CreateApprovalAssignmentSchema', () => {
    const validCreate = {
      member_user_id: '123e4567-e89b-12d3-a456-426614174000',
      approver_user_id: '123e4567-e89b-12d3-a456-426614174001',
    };

    it('should accept valid create data', () => {
      const result = CreateApprovalAssignmentSchema.safeParse(validCreate);
      expect(result.success).toBe(true);
    });

    it('should require valid UUIDs', () => {
      expect(
        CreateApprovalAssignmentSchema.safeParse({ ...validCreate, member_user_id: 'invalid' })
          .success
      ).toBe(false);
      expect(
        CreateApprovalAssignmentSchema.safeParse({ ...validCreate, approver_user_id: 'invalid' })
          .success
      ).toBe(false);
    });

    it('should reject self-approval (member cannot be their own approver)', () => {
      const sameId = '123e4567-e89b-12d3-a456-426614174000';
      const result = CreateApprovalAssignmentSchema.safeParse({
        member_user_id: sameId,
        approver_user_id: sameId,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some(i => i.path.includes('approver_user_id'))).toBe(true);
      }
    });

    it('should REJECT server-managed fields', () => {
      // CreateApprovalAssignmentSchema uses .refine(), so we test by checking
      // that server-managed fields are not accepted
      const withServerId = CreateApprovalAssignmentSchema.safeParse({
        member_user_id: '123e4567-e89b-12d3-a456-426614174000',
        approver_user_id: '123e4567-e89b-12d3-a456-426614174001',
        id: '123e4567-e89b-12d3-a456-426614174002',
        workspace_id: '123e4567-e89b-12d3-a456-426614174003',
        created_by: '123e4567-e89b-12d3-a456-426614174004',
        created_at: '2024-03-01T10:00:00.000Z',
      });
      // The schema should succeed but strip the extra fields
      expect(withServerId.success).toBe(true);
      if (withServerId.success) {
        expect('id' in withServerId.data).toBe(false);
        expect('workspace_id' in withServerId.data).toBe(false);
        expect('created_by' in withServerId.data).toBe(false);
        expect('created_at' in withServerId.data).toBe(false);
      }
    });
  });

  // ============================================================================
  // SubmitEntriesInputSchema Tests
  // ============================================================================

  describe('SubmitEntriesInputSchema', () => {
    it('should accept valid entry IDs array', () => {
      const result = SubmitEntriesInputSchema.safeParse({
        entry_ids: ['123e4567-e89b-12d3-a456-426614174000', '123e4567-e89b-12d3-a456-426614174001'],
      });
      expect(result.success).toBe(true);
    });

    it('should accept single entry ID', () => {
      const result = SubmitEntriesInputSchema.safeParse({
        entry_ids: ['123e4567-e89b-12d3-a456-426614174000'],
      });
      expect(result.success).toBe(true);
    });

    it('should reject empty entry_ids array', () => {
      const result = SubmitEntriesInputSchema.safeParse({ entry_ids: [] });
      expect(result.success).toBe(false);
    });

    it('should require valid UUIDs in array', () => {
      const result = SubmitEntriesInputSchema.safeParse({
        entry_ids: ['invalid-uuid'],
      });
      expect(result.success).toBe(false);
    });

    it('should require entry_ids field', () => {
      const result = SubmitEntriesInputSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  // ============================================================================
  // ApproveEntriesInputSchema Tests
  // ============================================================================

  describe('ApproveEntriesInputSchema', () => {
    const validApprove = {
      entry_ids: ['123e4567-e89b-12d3-a456-426614174000'],
      approval_note: 'Looks good!',
    };

    it('should accept valid approve data', () => {
      const result = ApproveEntriesInputSchema.safeParse(validApprove);
      expect(result.success).toBe(true);
    });

    it('should allow optional approval_note', () => {
      const { approval_note: _n, ...withoutNote } = validApprove;
      const result = ApproveEntriesInputSchema.safeParse(withoutNote);
      expect(result.success).toBe(true);
    });

    it('should validate approval_note max length (500)', () => {
      const maxNote = 'a'.repeat(500);
      expect(
        ApproveEntriesInputSchema.safeParse({ ...validApprove, approval_note: maxNote }).success
      ).toBe(true);

      const tooLongNote = 'a'.repeat(501);
      expect(
        ApproveEntriesInputSchema.safeParse({ ...validApprove, approval_note: tooLongNote }).success
      ).toBe(false);
    });

    it('should reject empty entry_ids array', () => {
      const result = ApproveEntriesInputSchema.safeParse({ entry_ids: [] });
      expect(result.success).toBe(false);
    });
  });

  // ============================================================================
  // RejectEntriesInputSchema Tests
  // ============================================================================

  describe('RejectEntriesInputSchema', () => {
    const validReject = {
      entry_ids: ['123e4567-e89b-12d3-a456-426614174000'],
      approval_note: 'Missing description. Please add more details.',
    };

    it('should accept valid reject data', () => {
      const result = RejectEntriesInputSchema.safeParse(validReject);
      expect(result.success).toBe(true);
    });

    it('should REQUIRE approval_note (rejection reason is mandatory)', () => {
      const { approval_note: _n, ...withoutNote } = validReject;
      const result = RejectEntriesInputSchema.safeParse(withoutNote);
      expect(result.success).toBe(false);
    });

    it('should reject empty approval_note', () => {
      const result = RejectEntriesInputSchema.safeParse({ ...validReject, approval_note: '' });
      expect(result.success).toBe(false);
    });

    it('should validate approval_note max length (500)', () => {
      const maxNote = 'a'.repeat(500);
      expect(
        RejectEntriesInputSchema.safeParse({ ...validReject, approval_note: maxNote }).success
      ).toBe(true);

      const tooLongNote = 'a'.repeat(501);
      expect(
        RejectEntriesInputSchema.safeParse({ ...validReject, approval_note: tooLongNote }).success
      ).toBe(false);
    });

    it('should reject empty entry_ids array', () => {
      const result = RejectEntriesInputSchema.safeParse({
        entry_ids: [],
        approval_note: 'Reason',
      });
      expect(result.success).toBe(false);
    });
  });

  // ============================================================================
  // ApprovalFilterSchema Tests
  // ============================================================================

  describe('ApprovalFilterSchema', () => {
    it('should accept valid filter with all fields', () => {
      const result = ApprovalFilterSchema.safeParse({
        status: 'submitted',
        workspaceId: '123e4567-e89b-12d3-a456-426614174000',
        memberId: '123e4567-e89b-12d3-a456-426614174001',
        dateStart: '2024-03-01T00:00:00.000Z',
        dateEnd: '2024-03-31T23:59:59.999Z',
      });
      expect(result.success).toBe(true);
    });

    it('should accept empty object (all optional)', () => {
      const result = ApprovalFilterSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('should validate status enum when provided', () => {
      expect(ApprovalFilterSchema.safeParse({ status: 'draft' }).success).toBe(true);
      expect(ApprovalFilterSchema.safeParse({ status: 'submitted' }).success).toBe(true);
      expect(ApprovalFilterSchema.safeParse({ status: 'approved' }).success).toBe(true);
      expect(ApprovalFilterSchema.safeParse({ status: 'rejected' }).success).toBe(true);
      expect(ApprovalFilterSchema.safeParse({ status: 'invalid' }).success).toBe(false);
    });

    it('should require valid UUID for workspaceId when provided', () => {
      expect(
        ApprovalFilterSchema.safeParse({ workspaceId: '123e4567-e89b-12d3-a456-426614174000' })
          .success
      ).toBe(true);
      expect(ApprovalFilterSchema.safeParse({ workspaceId: 'invalid' }).success).toBe(false);
    });

    it('should require valid datetime for date fields when provided', () => {
      expect(ApprovalFilterSchema.safeParse({ dateStart: 'invalid' }).success).toBe(false);
      expect(ApprovalFilterSchema.safeParse({ dateEnd: 'invalid' }).success).toBe(false);
    });
  });
});
