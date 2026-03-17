/**
 * Project Schema Tests
 *
 * Tests all project Zod schemas with valid and invalid inputs.
 * Tests ProjectSchema, ProjectMemberSchema, CreateProjectSchema,
 * UpdateProjectSchema, AddProjectMemberSchema, ProjectsFilterSchema, etc.
 */

import {
  DEFAULT_PROJECT_COLOR,
  ProjectSchema,
  ProjectMemberSchema,
  ProjectMemberWithUserSchema,
  ProjectWithMembersSchema,
  ProjectWithStatsSchema,
  CreateProjectSchema,
  UpdateProjectSchema,
  AddProjectMemberSchema,
  ProjectsFilterSchema,
} from '@/schemas/project';

describe('Project Schemas', () => {
  // ============================================================================
  // Constants Tests
  // ============================================================================

  describe('Constants', () => {
    it('should have correct default project color', () => {
      expect(DEFAULT_PROJECT_COLOR).toBe('#6366F1');
    });
  });

  // ============================================================================
  // ProjectSchema Tests
  // ============================================================================

  describe('ProjectSchema', () => {
    const validProject = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      workspace_id: '123e4567-e89b-12d3-a456-426614174001',
      name: 'Website Redesign',
      color: '#6366F1',
      description: 'A project to redesign the company website.',
      is_archived: false,
      created_by: '123e4567-e89b-12d3-a456-426614174002',
      created_at: '2024-03-01T10:00:00.000Z',
    };

    it('should accept valid project data', () => {
      const result = ProjectSchema.safeParse(validProject);
      expect(result.success).toBe(true);
    });

    it('should require valid UUIDs', () => {
      expect(ProjectSchema.safeParse({ ...validProject, id: 'invalid' }).success).toBe(false);
      expect(ProjectSchema.safeParse({ ...validProject, workspace_id: 'invalid' }).success).toBe(
        false
      );
      expect(ProjectSchema.safeParse({ ...validProject, created_by: 'invalid' }).success).toBe(
        false
      );
    });

    it('should validate name min length (1)', () => {
      expect(ProjectSchema.safeParse({ ...validProject, name: '' }).success).toBe(false);
      expect(ProjectSchema.safeParse({ ...validProject, name: 'A' }).success).toBe(true);
    });

    it('should validate name max length (100)', () => {
      const maxName = 'a'.repeat(100);
      expect(ProjectSchema.safeParse({ ...validProject, name: maxName }).success).toBe(true);

      const tooLongName = 'a'.repeat(101);
      expect(ProjectSchema.safeParse({ ...validProject, name: tooLongName }).success).toBe(false);
    });

    it('should validate hex color format', () => {
      // Valid colors
      expect(ProjectSchema.safeParse({ ...validProject, color: '#6366F1' }).success).toBe(true);
      expect(ProjectSchema.safeParse({ ...validProject, color: '#ffffff' }).success).toBe(true);
      expect(ProjectSchema.safeParse({ ...validProject, color: '#000000' }).success).toBe(true);
      expect(ProjectSchema.safeParse({ ...validProject, color: '#AABBCC' }).success).toBe(true);

      // Invalid colors
      expect(ProjectSchema.safeParse({ ...validProject, color: '#fff' }).success).toBe(false); // 3-char
      expect(ProjectSchema.safeParse({ ...validProject, color: '6366F1' }).success).toBe(false); // no #
      expect(ProjectSchema.safeParse({ ...validProject, color: '#GGGGGG' }).success).toBe(false); // invalid hex
      expect(ProjectSchema.safeParse({ ...validProject, color: 'red' }).success).toBe(false); // named color
    });

    it('should allow null description', () => {
      const result = ProjectSchema.safeParse({ ...validProject, description: null });
      expect(result.success).toBe(true);
    });

    it('should validate description max length (1000)', () => {
      const maxDesc = 'a'.repeat(1000);
      expect(ProjectSchema.safeParse({ ...validProject, description: maxDesc }).success).toBe(true);

      const tooLongDesc = 'a'.repeat(1001);
      expect(ProjectSchema.safeParse({ ...validProject, description: tooLongDesc }).success).toBe(
        false
      );
    });

    it('should default is_archived to false', () => {
      const { is_archived, ...withoutArchived } = validProject;
      const result = ProjectSchema.safeParse(withoutArchived);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.is_archived).toBe(false);
      }
    });

    it('should require valid datetime for created_at', () => {
      const result = ProjectSchema.safeParse({ ...validProject, created_at: 'invalid-date' });
      expect(result.success).toBe(false);
    });

    it('should reject missing required fields', () => {
      const { id, ...withoutId } = validProject;
      expect(ProjectSchema.safeParse(withoutId).success).toBe(false);

      const { workspace_id, ...withoutWorkspaceId } = validProject;
      expect(ProjectSchema.safeParse(withoutWorkspaceId).success).toBe(false);

      const { name, ...withoutName } = validProject;
      expect(ProjectSchema.safeParse(withoutName).success).toBe(false);
    });
  });

  // ============================================================================
  // ProjectMemberSchema Tests
  // ============================================================================

  describe('ProjectMemberSchema', () => {
    const validMember = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      project_id: '123e4567-e89b-12d3-a456-426614174001',
      user_id: '123e4567-e89b-12d3-a456-426614174002',
      role: 'member',
      added_at: '2024-03-01T10:00:00.000Z',
    };

    it('should accept valid member data', () => {
      const result = ProjectMemberSchema.safeParse(validMember);
      expect(result.success).toBe(true);
    });

    it('should require valid UUIDs', () => {
      expect(ProjectMemberSchema.safeParse({ ...validMember, id: 'invalid' }).success).toBe(false);
      expect(ProjectMemberSchema.safeParse({ ...validMember, project_id: 'invalid' }).success).toBe(
        false
      );
      expect(ProjectMemberSchema.safeParse({ ...validMember, user_id: 'invalid' }).success).toBe(
        false
      );
    });

    it('should accept valid role values (uses WorkspaceRoleEnum)', () => {
      expect(ProjectMemberSchema.safeParse({ ...validMember, role: 'owner' }).success).toBe(true);
      expect(ProjectMemberSchema.safeParse({ ...validMember, role: 'admin' }).success).toBe(true);
      expect(ProjectMemberSchema.safeParse({ ...validMember, role: 'member' }).success).toBe(true);
    });

    it('should default role to member', () => {
      const { role, ...withoutRole } = validMember;
      const result = ProjectMemberSchema.safeParse(withoutRole);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.role).toBe('member');
      }
    });

    it('should require valid datetime for added_at', () => {
      const result = ProjectMemberSchema.safeParse({ ...validMember, added_at: 'invalid-date' });
      expect(result.success).toBe(false);
    });
  });

  // ============================================================================
  // ProjectMemberWithUserSchema Tests
  // ============================================================================

  describe('ProjectMemberWithUserSchema', () => {
    const validMemberWithUser = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      project_id: '123e4567-e89b-12d3-a456-426614174001',
      user_id: '123e4567-e89b-12d3-a456-426614174002',
      role: 'member',
      added_at: '2024-03-01T10:00:00.000Z',
      user: {
        id: '123e4567-e89b-12d3-a456-426614174002',
        email: 'user@example.com',
        name: 'John Doe',
      },
    };

    it('should accept valid member with user data', () => {
      const result = ProjectMemberWithUserSchema.safeParse(validMemberWithUser);
      expect(result.success).toBe(true);
    });

    it('should allow null name in user', () => {
      const result = ProjectMemberWithUserSchema.safeParse({
        ...validMemberWithUser,
        user: { ...validMemberWithUser.user, name: null },
      });
      expect(result.success).toBe(true);
    });

    it('should require valid email in user', () => {
      const result = ProjectMemberWithUserSchema.safeParse({
        ...validMemberWithUser,
        user: { ...validMemberWithUser.user, email: 'invalid-email' },
      });
      expect(result.success).toBe(false);
    });
  });

  // ============================================================================
  // ProjectWithMembersSchema Tests
  // ============================================================================

  describe('ProjectWithMembersSchema', () => {
    const validProjectWithMembers = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      workspace_id: '123e4567-e89b-12d3-a456-426614174001',
      name: 'Website Redesign',
      color: '#6366F1',
      description: null,
      is_archived: false,
      created_by: '123e4567-e89b-12d3-a456-426614174002',
      created_at: '2024-03-01T10:00:00.000Z',
      members: [
        {
          id: '123e4567-e89b-12d3-a456-426614174003',
          project_id: '123e4567-e89b-12d3-a456-426614174000',
          user_id: '123e4567-e89b-12d3-a456-426614174002',
          role: 'owner',
          added_at: '2024-03-01T10:00:00.000Z',
          user: {
            id: '123e4567-e89b-12d3-a456-426614174002',
            email: 'user@example.com',
            name: 'John Doe',
          },
        },
      ],
      total_time_seconds: 3600,
      entry_count: 5,
    };

    it('should accept valid project with members', () => {
      const result = ProjectWithMembersSchema.safeParse(validProjectWithMembers);
      expect(result.success).toBe(true);
    });

    it('should allow optional members array', () => {
      const { members, ...withoutMembers } = validProjectWithMembers;
      const result = ProjectWithMembersSchema.safeParse(withoutMembers);
      expect(result.success).toBe(true);
    });

    it('should allow optional total_time_seconds', () => {
      const { total_time_seconds, ...withoutTime } = validProjectWithMembers;
      const result = ProjectWithMembersSchema.safeParse(withoutTime);
      expect(result.success).toBe(true);
    });

    it('should reject negative total_time_seconds', () => {
      const result = ProjectWithMembersSchema.safeParse({
        ...validProjectWithMembers,
        total_time_seconds: -1,
      });
      expect(result.success).toBe(false);
    });
  });

  // ============================================================================
  // ProjectWithStatsSchema Tests
  // ============================================================================

  describe('ProjectWithStatsSchema', () => {
    const validProjectWithStats = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      workspace_id: '123e4567-e89b-12d3-a456-426614174001',
      name: 'Website Redesign',
      color: '#6366F1',
      description: null,
      is_archived: false,
      created_by: '123e4567-e89b-12d3-a456-426614174002',
      created_at: '2024-03-01T10:00:00.000Z',
      member_count: 3,
      total_time_seconds: 7200,
      is_member: true,
      current_user_role: 'admin',
    };

    it('should accept valid project with stats', () => {
      const result = ProjectWithStatsSchema.safeParse(validProjectWithStats);
      expect(result.success).toBe(true);
    });

    it('should allow all optional stat fields to be missing', () => {
      const { member_count, total_time_seconds, is_member, current_user_role, ...base } =
        validProjectWithStats;
      const result = ProjectWithStatsSchema.safeParse(base);
      expect(result.success).toBe(true);
    });

    it('should reject negative member_count', () => {
      const result = ProjectWithStatsSchema.safeParse({
        ...validProjectWithStats,
        member_count: -1,
      });
      expect(result.success).toBe(false);
    });

    it('should validate current_user_role enum', () => {
      expect(
        ProjectWithStatsSchema.safeParse({ ...validProjectWithStats, current_user_role: 'owner' })
          .success
      ).toBe(true);
      expect(
        ProjectWithStatsSchema.safeParse({ ...validProjectWithStats, current_user_role: 'invalid' })
          .success
      ).toBe(false);
    });
  });

  // ============================================================================
  // CreateProjectSchema Tests
  // ============================================================================

  describe('CreateProjectSchema', () => {
    const validCreate = {
      name: 'New Project',
      color: '#FF5733',
      description: 'Project description',
    };

    it('should accept valid create data', () => {
      const result = CreateProjectSchema.safeParse(validCreate);
      expect(result.success).toBe(true);
    });

    it('should accept minimal create data (name only)', () => {
      const result = CreateProjectSchema.safeParse({ name: 'Minimal Project' });
      expect(result.success).toBe(true);
    });

    it('should reject empty name', () => {
      const result = CreateProjectSchema.safeParse({ ...validCreate, name: '' });
      expect(result.success).toBe(false);
    });

    it('should validate name max length (100)', () => {
      const maxName = 'a'.repeat(100);
      expect(CreateProjectSchema.safeParse({ ...validCreate, name: maxName }).success).toBe(true);

      const tooLongName = 'a'.repeat(101);
      expect(CreateProjectSchema.safeParse({ ...validCreate, name: tooLongName }).success).toBe(
        false
      );
    });

    it('should validate hex color when provided', () => {
      expect(CreateProjectSchema.safeParse({ ...validCreate, color: '#AABBCC' }).success).toBe(
        true
      );
      expect(CreateProjectSchema.safeParse({ ...validCreate, color: 'invalid' }).success).toBe(
        false
      );
    });

    it('should allow optional color', () => {
      const { color, ...withoutColor } = validCreate;
      const result = CreateProjectSchema.safeParse(withoutColor);
      expect(result.success).toBe(true);
    });

    it('should validate description max length (1000)', () => {
      const maxDesc = 'a'.repeat(1000);
      expect(CreateProjectSchema.safeParse({ ...validCreate, description: maxDesc }).success).toBe(
        true
      );

      const tooLongDesc = 'a'.repeat(1001);
      expect(
        CreateProjectSchema.safeParse({ ...validCreate, description: tooLongDesc }).success
      ).toBe(false);
    });

    it('should allow null description', () => {
      const result = CreateProjectSchema.safeParse({ ...validCreate, description: null });
      expect(result.success).toBe(true);
    });

    it('should REJECT server-managed fields', () => {
      const schema = CreateProjectSchema.shape;

      expect('id' in schema).toBe(false);
      expect('workspace_id' in schema).toBe(false);
      expect('created_by' in schema).toBe(false);
      expect('created_at' in schema).toBe(false);
      expect('is_archived' in schema).toBe(false);
    });
  });

  // ============================================================================
  // UpdateProjectSchema Tests
  // ============================================================================

  describe('UpdateProjectSchema', () => {
    it('should accept valid update with name only', () => {
      const result = UpdateProjectSchema.safeParse({ name: 'Updated Name' });
      expect(result.success).toBe(true);
    });

    it('should accept valid update with color only', () => {
      const result = UpdateProjectSchema.safeParse({ color: '#AABBCC' });
      expect(result.success).toBe(true);
    });

    it('should accept valid update with description', () => {
      const result = UpdateProjectSchema.safeParse({ description: 'Updated description' });
      expect(result.success).toBe(true);
    });

    it('should accept valid update with is_archived', () => {
      const result = UpdateProjectSchema.safeParse({ is_archived: true });
      expect(result.success).toBe(true);
    });

    it('should accept empty object (no updates)', () => {
      const result = UpdateProjectSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('should reject invalid color when provided', () => {
      const result = UpdateProjectSchema.safeParse({ color: 'not-a-color' });
      expect(result.success).toBe(false);
    });

    it('should reject empty name when provided', () => {
      const result = UpdateProjectSchema.safeParse({ name: '' });
      expect(result.success).toBe(false);
    });

    it('should allow null description', () => {
      const result = UpdateProjectSchema.safeParse({ description: null });
      expect(result.success).toBe(true);
    });

    it('should REJECT server-managed fields', () => {
      const schema = UpdateProjectSchema.shape;

      expect('id' in schema).toBe(false);
      expect('workspace_id' in schema).toBe(false);
      expect('created_by' in schema).toBe(false);
      expect('created_at' in schema).toBe(false);
    });
  });

  // ============================================================================
  // AddProjectMemberSchema Tests
  // ============================================================================

  describe('AddProjectMemberSchema', () => {
    const validMember = {
      user_id: '123e4567-e89b-12d3-a456-426614174000',
      role: 'member',
    };

    it('should accept valid member data', () => {
      const result = AddProjectMemberSchema.safeParse(validMember);
      expect(result.success).toBe(true);
    });

    it('should require valid UUID for user_id', () => {
      const result = AddProjectMemberSchema.safeParse({ ...validMember, user_id: 'invalid' });
      expect(result.success).toBe(false);
    });

    it('should default role to member', () => {
      const result = AddProjectMemberSchema.safeParse({
        user_id: '123e4567-e89b-12d3-a456-426614174000',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.role).toBe('member');
      }
    });

    it('should only accept admin or member roles (not owner)', () => {
      expect(AddProjectMemberSchema.safeParse({ ...validMember, role: 'admin' }).success).toBe(
        true
      );
      expect(AddProjectMemberSchema.safeParse({ ...validMember, role: 'member' }).success).toBe(
        true
      );
      expect(AddProjectMemberSchema.safeParse({ ...validMember, role: 'owner' }).success).toBe(
        false
      );
    });
  });

  // ============================================================================
  // ProjectsFilterSchema Tests
  // ============================================================================

  describe('ProjectsFilterSchema', () => {
    it('should accept valid filter with all fields', () => {
      const result = ProjectsFilterSchema.safeParse({
        search: 'website',
        workspaceId: '123e4567-e89b-12d3-a456-426614174000',
        includeArchived: true,
        memberOnly: false,
      });
      expect(result.success).toBe(true);
    });

    it('should accept empty object (all optional)', () => {
      const result = ProjectsFilterSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('should provide default includeArchived as false', () => {
      const result = ProjectsFilterSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.includeArchived).toBe(false);
      }
    });

    it('should provide default memberOnly as true', () => {
      const result = ProjectsFilterSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.memberOnly).toBe(true);
      }
    });

    it('should require valid UUID for workspaceId when provided', () => {
      const validResult = ProjectsFilterSchema.safeParse({
        workspaceId: '123e4567-e89b-12d3-a456-426614174000',
      });
      expect(validResult.success).toBe(true);

      const invalidResult = ProjectsFilterSchema.safeParse({ workspaceId: 'invalid' });
      expect(invalidResult.success).toBe(false);
    });

    it('should allow optional search', () => {
      const result = ProjectsFilterSchema.safeParse({ search: 'test query' });
      expect(result.success).toBe(true);
    });
  });
});
