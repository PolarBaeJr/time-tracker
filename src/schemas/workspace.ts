import { z } from 'zod';

/**
 * Workspace Schemas - Validation schemas for team collaboration features
 *
 * Workspaces are shared orgs where users can collaborate on time tracking.
 * A user can belong to multiple workspaces.
 */

// =============================================================================
// ENUMS
// =============================================================================

/**
 * Workspace role enum - matches database workspace_role ENUM
 * - owner: Created the workspace, can delete it, full control
 * - admin: Can invite/remove members, approve entries, manage projects
 * - member: Can log time, view shared projects, participate in feed
 */
export const WorkspaceRoleEnum = z.enum(['owner', 'admin', 'member']);

/**
 * Workspace invite status enum - matches database invite_status ENUM
 */
export const InviteStatusEnum = z.enum(['pending', 'accepted', 'expired']);

// =============================================================================
// ENTITY SCHEMAS
// =============================================================================

/**
 * Workspace Schema - Entity schema for query responses
 *
 * Represents a shared workspace/organization that members belong to.
 */
export const WorkspaceSchema = z.object({
  /** UUID primary key */
  id: z.string().uuid(),

  /**
   * Workspace display name
   * Must be between 1 and 100 characters
   */
  name: z.string().min(1).max(100),

  /**
   * URL-safe slug for the workspace
   * Must be 3-50 characters, lowercase alphanumeric with hyphens
   */
  slug: z
    .string()
    .min(3)
    .max(50)
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),

  /** UUID of the workspace owner (user who created it) */
  owner_id: z.string().uuid(),

  /** Timestamp when workspace was created */
  created_at: z.string().datetime({ offset: true }),
});

/**
 * Workspace Member Schema - Entity schema for query responses
 *
 * Represents a user's membership in a workspace.
 */
export const WorkspaceMemberSchema = z.object({
  /** UUID primary key */
  id: z.string().uuid(),

  /** UUID of the workspace */
  workspace_id: z.string().uuid(),

  /** UUID of the member user */
  user_id: z.string().uuid(),

  /** Member's role in the workspace */
  role: WorkspaceRoleEnum.default('member'),

  /** Timestamp when user joined the workspace */
  joined_at: z.string().datetime({ offset: true }),
});

/**
 * Workspace Member With User Schema - Includes user details
 *
 * Used for displaying member lists with user information.
 */
export const WorkspaceMemberWithUserSchema = WorkspaceMemberSchema.extend({
  /** Associated user details */
  user: z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    name: z.string().nullable(),
  }),
});

/**
 * Workspace Invite Schema - Entity schema for query responses
 *
 * Represents a pending or accepted workspace invitation.
 */
export const WorkspaceInviteSchema = z.object({
  /** UUID primary key */
  id: z.string().uuid(),

  /** UUID of the workspace being invited to */
  workspace_id: z.string().uuid(),

  /** Email address of the invited user */
  invited_email: z.string().email(),

  /** Role the invitee will have upon acceptance */
  role: WorkspaceRoleEnum.default('member'),

  /** UUID of the user who sent the invitation */
  invited_by: z.string().uuid(),

  /** Current status of the invitation */
  status: InviteStatusEnum.default('pending'),

  /** Timestamp when the invitation expires */
  expires_at: z.string().datetime({ offset: true }),

  /** Timestamp when invitation was created */
  created_at: z.string().datetime({ offset: true }),
});

/**
 * Workspace With Member Count Schema - Includes aggregate data
 *
 * Used for workspace list views.
 */
export const WorkspaceWithMemberCountSchema = WorkspaceSchema.extend({
  /** Total number of members in the workspace */
  member_count: z.number().int().nonnegative().optional(),

  /** Current user's role in the workspace */
  current_user_role: WorkspaceRoleEnum.optional(),
});

// =============================================================================
// MUTATION SCHEMAS
// =============================================================================

/**
 * Create Workspace Schema - Mutation schema for creating new workspaces
 *
 * EXCLUDES server-managed fields: id, owner_id, created_at
 * The creator is automatically set as the owner.
 */
export const CreateWorkspaceSchema = z.object({
  /** Workspace display name (1-100 characters) */
  name: z
    .string()
    .min(1, 'Workspace name is required')
    .max(100, 'Name must be 100 characters or less'),

  /**
   * URL-safe slug (3-50 characters)
   * Must be unique across all workspaces
   */
  slug: z
    .string()
    .min(3, 'Slug must be at least 3 characters')
    .max(50, 'Slug must be 50 characters or less')
    .regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens'),
});

/**
 * Update Workspace Schema - Mutation schema for updating workspace details
 *
 * EXCLUDES server-managed fields: id, owner_id, created_at
 * All fields optional for partial updates.
 */
export const UpdateWorkspaceSchema = CreateWorkspaceSchema.partial();

/**
 * Create Invite Schema - Mutation schema for sending workspace invitations
 *
 * EXCLUDES server-managed fields: id, workspace_id, invited_by, status, expires_at, created_at
 * Used by admins/owners to invite new members.
 */
export const CreateInviteSchema = z.object({
  /** Email address of the user to invite */
  email: z.string().email('Please enter a valid email address'),

  /** Role to assign upon acceptance (admin or member, not owner) */
  role: z.enum(['admin', 'member']).default('member'),
});

/**
 * Accept Invite Schema - Input for accepting a workspace invitation
 */
export const AcceptInviteSchema = z.object({
  /** The raw invitation token from the email link */
  token: z.string().uuid(),
});

// =============================================================================
// INFERRED TYPES
// =============================================================================

/** Workspace role type */
export type WorkspaceRole = z.infer<typeof WorkspaceRoleEnum>;

/** Invite status type */
export type InviteStatus = z.infer<typeof InviteStatusEnum>;

/** Workspace type */
export type Workspace = z.infer<typeof WorkspaceSchema>;

/** Workspace member type */
export type WorkspaceMember = z.infer<typeof WorkspaceMemberSchema>;

/** Workspace member with user details */
export type WorkspaceMemberWithUser = z.infer<typeof WorkspaceMemberWithUserSchema>;

/** Workspace invite type */
export type WorkspaceInvite = z.infer<typeof WorkspaceInviteSchema>;

/** Workspace with member count */
export type WorkspaceWithMemberCount = z.infer<typeof WorkspaceWithMemberCountSchema>;

/** Input type for creating workspaces */
export type CreateWorkspaceInput = z.infer<typeof CreateWorkspaceSchema>;

/** Input type for updating workspaces */
export type UpdateWorkspaceInput = z.infer<typeof UpdateWorkspaceSchema>;

/** Input type for creating invites */
export type CreateInviteInput = z.infer<typeof CreateInviteSchema>;

/** Input type for accepting invites */
export type AcceptInviteInput = z.infer<typeof AcceptInviteSchema>;
