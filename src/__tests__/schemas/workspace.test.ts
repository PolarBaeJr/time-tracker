/**
 * Workspace Schema Tests
 *
 * Tests all workspace Zod schemas with valid and invalid inputs.
 * Tests WorkspaceSchema, WorkspaceMemberSchema, WorkspaceInviteSchema,
 * CreateWorkspaceSchema, UpdateWorkspaceSchema, CreateInviteSchema, etc.
 */

import {
  WorkspaceRoleEnum,
  InviteStatusEnum,
  WorkspaceSchema,
  WorkspaceMemberSchema,
  WorkspaceMemberWithUserSchema,
  WorkspaceInviteSchema,
  WorkspaceWithMemberCountSchema,
  CreateWorkspaceSchema,
  UpdateWorkspaceSchema,
  CreateInviteSchema,
  AcceptInviteSchema,
} from '@/schemas/workspace';

describe('Workspace Schemas', () => {
  // ============================================================================
  // WorkspaceRoleEnum Tests
  // ============================================================================

  describe('WorkspaceRoleEnum', () => {
    it('should accept valid role values', () => {
      expect(WorkspaceRoleEnum.safeParse('owner').success).toBe(true);
      expect(WorkspaceRoleEnum.safeParse('admin').success).toBe(true);
      expect(WorkspaceRoleEnum.safeParse('member').success).toBe(true);
    });

    it('should reject invalid role values', () => {
      expect(WorkspaceRoleEnum.safeParse('superadmin').success).toBe(false);
      expect(WorkspaceRoleEnum.safeParse('guest').success).toBe(false);
      expect(WorkspaceRoleEnum.safeParse('').success).toBe(false);
      expect(WorkspaceRoleEnum.safeParse(null).success).toBe(false);
    });
  });

  // ============================================================================
  // InviteStatusEnum Tests
  // ============================================================================

  describe('InviteStatusEnum', () => {
    it('should accept valid invite status values', () => {
      expect(InviteStatusEnum.safeParse('pending').success).toBe(true);
      expect(InviteStatusEnum.safeParse('accepted').success).toBe(true);
      expect(InviteStatusEnum.safeParse('expired').success).toBe(true);
    });

    it('should reject invalid invite status values', () => {
      expect(InviteStatusEnum.safeParse('declined').success).toBe(false);
      expect(InviteStatusEnum.safeParse('revoked').success).toBe(false);
      expect(InviteStatusEnum.safeParse('').success).toBe(false);
      expect(InviteStatusEnum.safeParse(null).success).toBe(false);
    });
  });

  // ============================================================================
  // WorkspaceSchema Tests
  // ============================================================================

  describe('WorkspaceSchema', () => {
    const validWorkspace = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      name: 'Acme Corp',
      slug: 'acme-corp',
      owner_id: '123e4567-e89b-12d3-a456-426614174001',
      created_at: '2024-03-01T10:00:00.000Z',
    };

    it('should accept valid workspace data', () => {
      const result = WorkspaceSchema.safeParse(validWorkspace);
      expect(result.success).toBe(true);
    });

    it('should require valid UUID for id', () => {
      const result = WorkspaceSchema.safeParse({ ...validWorkspace, id: 'invalid' });
      expect(result.success).toBe(false);
    });

    it('should require valid UUID for owner_id', () => {
      const result = WorkspaceSchema.safeParse({ ...validWorkspace, owner_id: 'invalid' });
      expect(result.success).toBe(false);
    });

    it('should validate name min length (1)', () => {
      const result = WorkspaceSchema.safeParse({ ...validWorkspace, name: '' });
      expect(result.success).toBe(false);

      const singleChar = WorkspaceSchema.safeParse({ ...validWorkspace, name: 'A' });
      expect(singleChar.success).toBe(true);
    });

    it('should validate name max length (100)', () => {
      const maxName = 'a'.repeat(100);
      expect(WorkspaceSchema.safeParse({ ...validWorkspace, name: maxName }).success).toBe(true);

      const tooLongName = 'a'.repeat(101);
      expect(WorkspaceSchema.safeParse({ ...validWorkspace, name: tooLongName }).success).toBe(
        false
      );
    });

    it('should validate slug min length (3)', () => {
      expect(WorkspaceSchema.safeParse({ ...validWorkspace, slug: 'ab' }).success).toBe(false);
      expect(WorkspaceSchema.safeParse({ ...validWorkspace, slug: 'abc' }).success).toBe(true);
    });

    it('should validate slug max length (50)', () => {
      const maxSlug = 'a'.repeat(50);
      expect(WorkspaceSchema.safeParse({ ...validWorkspace, slug: maxSlug }).success).toBe(true);

      const tooLongSlug = 'a'.repeat(51);
      expect(WorkspaceSchema.safeParse({ ...validWorkspace, slug: tooLongSlug }).success).toBe(
        false
      );
    });

    it('should validate slug regex (lowercase alphanumeric with hyphens)', () => {
      // Valid slugs
      expect(WorkspaceSchema.safeParse({ ...validWorkspace, slug: 'acme-corp' }).success).toBe(
        true
      );
      expect(WorkspaceSchema.safeParse({ ...validWorkspace, slug: 'team123' }).success).toBe(true);
      expect(WorkspaceSchema.safeParse({ ...validWorkspace, slug: 'a-b-c' }).success).toBe(true);
      expect(WorkspaceSchema.safeParse({ ...validWorkspace, slug: '123' }).success).toBe(true);

      // Invalid slugs
      expect(WorkspaceSchema.safeParse({ ...validWorkspace, slug: 'Acme-Corp' }).success).toBe(
        false
      ); // uppercase
      expect(WorkspaceSchema.safeParse({ ...validWorkspace, slug: 'acme_corp' }).success).toBe(
        false
      ); // underscore
      expect(WorkspaceSchema.safeParse({ ...validWorkspace, slug: 'acme corp' }).success).toBe(
        false
      ); // space
      expect(WorkspaceSchema.safeParse({ ...validWorkspace, slug: 'acme.corp' }).success).toBe(
        false
      ); // dot
    });

    it('should require valid datetime for created_at', () => {
      const result = WorkspaceSchema.safeParse({ ...validWorkspace, created_at: 'invalid-date' });
      expect(result.success).toBe(false);
    });

    it('should reject missing required fields', () => {
      const { id, ...withoutId } = validWorkspace;
      expect(WorkspaceSchema.safeParse(withoutId).success).toBe(false);

      const { name, ...withoutName } = validWorkspace;
      expect(WorkspaceSchema.safeParse(withoutName).success).toBe(false);

      const { slug, ...withoutSlug } = validWorkspace;
      expect(WorkspaceSchema.safeParse(withoutSlug).success).toBe(false);

      const { owner_id, ...withoutOwnerId } = validWorkspace;
      expect(WorkspaceSchema.safeParse(withoutOwnerId).success).toBe(false);
    });
  });

  // ============================================================================
  // WorkspaceMemberSchema Tests
  // ============================================================================

  describe('WorkspaceMemberSchema', () => {
    const validMember = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      workspace_id: '123e4567-e89b-12d3-a456-426614174001',
      user_id: '123e4567-e89b-12d3-a456-426614174002',
      role: 'member',
      joined_at: '2024-03-01T10:00:00.000Z',
    };

    it('should accept valid member data', () => {
      const result = WorkspaceMemberSchema.safeParse(validMember);
      expect(result.success).toBe(true);
    });

    it('should require valid UUIDs', () => {
      expect(WorkspaceMemberSchema.safeParse({ ...validMember, id: 'invalid' }).success).toBe(
        false
      );
      expect(
        WorkspaceMemberSchema.safeParse({ ...validMember, workspace_id: 'invalid' }).success
      ).toBe(false);
      expect(WorkspaceMemberSchema.safeParse({ ...validMember, user_id: 'invalid' }).success).toBe(
        false
      );
    });

    it('should accept valid role values', () => {
      expect(WorkspaceMemberSchema.safeParse({ ...validMember, role: 'owner' }).success).toBe(true);
      expect(WorkspaceMemberSchema.safeParse({ ...validMember, role: 'admin' }).success).toBe(true);
      expect(WorkspaceMemberSchema.safeParse({ ...validMember, role: 'member' }).success).toBe(
        true
      );
    });

    it('should default role to member', () => {
      const { role, ...withoutRole } = validMember;
      const result = WorkspaceMemberSchema.safeParse(withoutRole);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.role).toBe('member');
      }
    });

    it('should require valid datetime for joined_at', () => {
      const result = WorkspaceMemberSchema.safeParse({
        ...validMember,
        joined_at: 'invalid-date',
      });
      expect(result.success).toBe(false);
    });
  });

  // ============================================================================
  // WorkspaceMemberWithUserSchema Tests
  // ============================================================================

  describe('WorkspaceMemberWithUserSchema', () => {
    const validMemberWithUser = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      workspace_id: '123e4567-e89b-12d3-a456-426614174001',
      user_id: '123e4567-e89b-12d3-a456-426614174002',
      role: 'member',
      joined_at: '2024-03-01T10:00:00.000Z',
      user: {
        id: '123e4567-e89b-12d3-a456-426614174002',
        email: 'user@example.com',
        name: 'John Doe',
      },
    };

    it('should accept valid member with user data', () => {
      const result = WorkspaceMemberWithUserSchema.safeParse(validMemberWithUser);
      expect(result.success).toBe(true);
    });

    it('should allow null name in user', () => {
      const result = WorkspaceMemberWithUserSchema.safeParse({
        ...validMemberWithUser,
        user: { ...validMemberWithUser.user, name: null },
      });
      expect(result.success).toBe(true);
    });

    it('should require valid email in user', () => {
      const result = WorkspaceMemberWithUserSchema.safeParse({
        ...validMemberWithUser,
        user: { ...validMemberWithUser.user, email: 'invalid-email' },
      });
      expect(result.success).toBe(false);
    });

    it('should require user object', () => {
      const { user, ...withoutUser } = validMemberWithUser;
      const result = WorkspaceMemberWithUserSchema.safeParse(withoutUser);
      expect(result.success).toBe(false);
    });
  });

  // ============================================================================
  // WorkspaceInviteSchema Tests
  // ============================================================================

  describe('WorkspaceInviteSchema', () => {
    const validInvite = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      workspace_id: '123e4567-e89b-12d3-a456-426614174001',
      invited_email: 'newuser@example.com',
      role: 'member',
      invited_by: '123e4567-e89b-12d3-a456-426614174002',
      status: 'pending',
      expires_at: '2024-03-08T10:00:00.000Z',
      created_at: '2024-03-01T10:00:00.000Z',
    };

    it('should accept valid invite data', () => {
      const result = WorkspaceInviteSchema.safeParse(validInvite);
      expect(result.success).toBe(true);
    });

    it('should require valid email for invited_email', () => {
      const result = WorkspaceInviteSchema.safeParse({
        ...validInvite,
        invited_email: 'invalid-email',
      });
      expect(result.success).toBe(false);
    });

    it('should accept valid status values', () => {
      expect(WorkspaceInviteSchema.safeParse({ ...validInvite, status: 'pending' }).success).toBe(
        true
      );
      expect(WorkspaceInviteSchema.safeParse({ ...validInvite, status: 'accepted' }).success).toBe(
        true
      );
      expect(WorkspaceInviteSchema.safeParse({ ...validInvite, status: 'expired' }).success).toBe(
        true
      );
    });

    it('should default status to pending', () => {
      const { status, ...withoutStatus } = validInvite;
      const result = WorkspaceInviteSchema.safeParse(withoutStatus);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe('pending');
      }
    });

    it('should default role to member', () => {
      const { role, ...withoutRole } = validInvite;
      const result = WorkspaceInviteSchema.safeParse(withoutRole);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.role).toBe('member');
      }
    });

    it('should require valid datetime for expires_at and created_at', () => {
      expect(
        WorkspaceInviteSchema.safeParse({ ...validInvite, expires_at: 'invalid' }).success
      ).toBe(false);
      expect(
        WorkspaceInviteSchema.safeParse({ ...validInvite, created_at: 'invalid' }).success
      ).toBe(false);
    });
  });

  // ============================================================================
  // WorkspaceWithMemberCountSchema Tests
  // ============================================================================

  describe('WorkspaceWithMemberCountSchema', () => {
    const validWorkspaceWithCount = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      name: 'Acme Corp',
      slug: 'acme-corp',
      owner_id: '123e4567-e89b-12d3-a456-426614174001',
      created_at: '2024-03-01T10:00:00.000Z',
      member_count: 5,
      current_user_role: 'admin',
    };

    it('should accept valid data with member count', () => {
      const result = WorkspaceWithMemberCountSchema.safeParse(validWorkspaceWithCount);
      expect(result.success).toBe(true);
    });

    it('should allow optional member_count', () => {
      const { member_count, ...withoutCount } = validWorkspaceWithCount;
      const result = WorkspaceWithMemberCountSchema.safeParse(withoutCount);
      expect(result.success).toBe(true);
    });

    it('should allow optional current_user_role', () => {
      const { current_user_role, ...withoutRole } = validWorkspaceWithCount;
      const result = WorkspaceWithMemberCountSchema.safeParse(withoutRole);
      expect(result.success).toBe(true);
    });

    it('should reject negative member_count', () => {
      const result = WorkspaceWithMemberCountSchema.safeParse({
        ...validWorkspaceWithCount,
        member_count: -1,
      });
      expect(result.success).toBe(false);
    });

    it('should validate current_user_role enum', () => {
      expect(
        WorkspaceWithMemberCountSchema.safeParse({
          ...validWorkspaceWithCount,
          current_user_role: 'owner',
        }).success
      ).toBe(true);
      expect(
        WorkspaceWithMemberCountSchema.safeParse({
          ...validWorkspaceWithCount,
          current_user_role: 'invalid',
        }).success
      ).toBe(false);
    });
  });

  // ============================================================================
  // CreateWorkspaceSchema Tests
  // ============================================================================

  describe('CreateWorkspaceSchema', () => {
    const validCreate = {
      name: 'New Workspace',
      slug: 'new-workspace',
    };

    it('should accept valid create data', () => {
      const result = CreateWorkspaceSchema.safeParse(validCreate);
      expect(result.success).toBe(true);
    });

    it('should reject empty name', () => {
      const result = CreateWorkspaceSchema.safeParse({ ...validCreate, name: '' });
      expect(result.success).toBe(false);
    });

    it('should validate name max length (100)', () => {
      const maxName = 'a'.repeat(100);
      expect(CreateWorkspaceSchema.safeParse({ ...validCreate, name: maxName }).success).toBe(true);

      const tooLongName = 'a'.repeat(101);
      expect(CreateWorkspaceSchema.safeParse({ ...validCreate, name: tooLongName }).success).toBe(
        false
      );
    });

    it('should validate slug min length (3)', () => {
      expect(CreateWorkspaceSchema.safeParse({ ...validCreate, slug: 'ab' }).success).toBe(false);
      expect(CreateWorkspaceSchema.safeParse({ ...validCreate, slug: 'abc' }).success).toBe(true);
    });

    it('should validate slug max length (50)', () => {
      const maxSlug = 'a'.repeat(50);
      expect(CreateWorkspaceSchema.safeParse({ ...validCreate, slug: maxSlug }).success).toBe(true);

      const tooLongSlug = 'a'.repeat(51);
      expect(CreateWorkspaceSchema.safeParse({ ...validCreate, slug: tooLongSlug }).success).toBe(
        false
      );
    });

    it('should validate slug regex (lowercase alphanumeric with hyphens)', () => {
      // Valid slugs
      expect(CreateWorkspaceSchema.safeParse({ ...validCreate, slug: 'my-team' }).success).toBe(
        true
      );
      expect(CreateWorkspaceSchema.safeParse({ ...validCreate, slug: 'team123' }).success).toBe(
        true
      );

      // Invalid slugs
      expect(CreateWorkspaceSchema.safeParse({ ...validCreate, slug: 'My-Team' }).success).toBe(
        false
      );
      expect(CreateWorkspaceSchema.safeParse({ ...validCreate, slug: 'my_team' }).success).toBe(
        false
      );
      expect(CreateWorkspaceSchema.safeParse({ ...validCreate, slug: 'my team' }).success).toBe(
        false
      );
    });

    it('should REJECT server-managed fields', () => {
      const schema = CreateWorkspaceSchema.shape;

      expect('id' in schema).toBe(false);
      expect('owner_id' in schema).toBe(false);
      expect('created_at' in schema).toBe(false);
    });
  });

  // ============================================================================
  // UpdateWorkspaceSchema Tests
  // ============================================================================

  describe('UpdateWorkspaceSchema', () => {
    it('should accept valid update with name only', () => {
      const result = UpdateWorkspaceSchema.safeParse({ name: 'Updated Name' });
      expect(result.success).toBe(true);
    });

    it('should accept valid update with slug only', () => {
      const result = UpdateWorkspaceSchema.safeParse({ slug: 'updated-slug' });
      expect(result.success).toBe(true);
    });

    it('should accept empty object (no updates)', () => {
      const result = UpdateWorkspaceSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('should validate name when provided', () => {
      expect(UpdateWorkspaceSchema.safeParse({ name: '' }).success).toBe(false);
      expect(UpdateWorkspaceSchema.safeParse({ name: 'a'.repeat(101) }).success).toBe(false);
    });

    it('should validate slug when provided', () => {
      expect(UpdateWorkspaceSchema.safeParse({ slug: 'ab' }).success).toBe(false); // too short
      expect(UpdateWorkspaceSchema.safeParse({ slug: 'My-Slug' }).success).toBe(false); // uppercase
    });

    it('should REJECT server-managed fields', () => {
      const schema = UpdateWorkspaceSchema.shape;

      expect('id' in schema).toBe(false);
      expect('owner_id' in schema).toBe(false);
      expect('created_at' in schema).toBe(false);
    });
  });

  // ============================================================================
  // CreateInviteSchema Tests
  // ============================================================================

  describe('CreateInviteSchema', () => {
    const validInvite = {
      email: 'newuser@example.com',
      role: 'member',
    };

    it('should accept valid invite data', () => {
      const result = CreateInviteSchema.safeParse(validInvite);
      expect(result.success).toBe(true);
    });

    it('should reject invalid email', () => {
      const result = CreateInviteSchema.safeParse({ ...validInvite, email: 'invalid' });
      expect(result.success).toBe(false);
    });

    it('should default role to member', () => {
      const result = CreateInviteSchema.safeParse({ email: 'user@example.com' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.role).toBe('member');
      }
    });

    it('should only accept admin or member roles (not owner)', () => {
      expect(CreateInviteSchema.safeParse({ ...validInvite, role: 'admin' }).success).toBe(true);
      expect(CreateInviteSchema.safeParse({ ...validInvite, role: 'member' }).success).toBe(true);
      expect(CreateInviteSchema.safeParse({ ...validInvite, role: 'owner' }).success).toBe(false);
    });

    it('should REJECT server-managed fields', () => {
      const schema = CreateInviteSchema.shape;

      expect('id' in schema).toBe(false);
      expect('workspace_id' in schema).toBe(false);
      expect('invited_by' in schema).toBe(false);
      expect('status' in schema).toBe(false);
      expect('expires_at' in schema).toBe(false);
      expect('created_at' in schema).toBe(false);
    });
  });

  // ============================================================================
  // AcceptInviteSchema Tests
  // ============================================================================

  describe('AcceptInviteSchema', () => {
    it('should accept valid token UUID', () => {
      const result = AcceptInviteSchema.safeParse({
        token: '123e4567-e89b-12d3-a456-426614174000',
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid token', () => {
      expect(AcceptInviteSchema.safeParse({ token: 'invalid' }).success).toBe(false);
      expect(AcceptInviteSchema.safeParse({ token: '' }).success).toBe(false);
      expect(AcceptInviteSchema.safeParse({}).success).toBe(false);
    });
  });
});
