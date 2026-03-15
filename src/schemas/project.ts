import { z } from 'zod';
import { WorkspaceRoleEnum } from './workspace';

/**
 * Project Schemas - Validation schemas for shared workspace projects
 *
 * Projects are entities within a workspace that members can log time against.
 * Projects are invite-only per project - creator explicitly adds members.
 */

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Default project color (indigo)
 */
export const DEFAULT_PROJECT_COLOR = '#6366F1';

/**
 * Hex color regex pattern
 */
const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;

// =============================================================================
// ENTITY SCHEMAS
// =============================================================================

/**
 * Project Schema - Entity schema for query responses
 *
 * Represents a shared project within a workspace that members can log time against.
 */
export const ProjectSchema = z.object({
  /** UUID primary key */
  id: z.string().uuid(),

  /** UUID of the parent workspace */
  workspace_id: z.string().uuid(),

  /**
   * Project display name
   * Must be between 1 and 100 characters
   */
  name: z.string().min(1).max(100),

  /**
   * Project color for visual identification
   * Must be a valid hex color code
   */
  color: z
    .string()
    .regex(HEX_COLOR_REGEX, 'Color must be a valid hex color (e.g., #6366F1)')
    .default(DEFAULT_PROJECT_COLOR),

  /**
   * Project description (optional)
   * Max 1000 characters
   */
  description: z.string().max(1000).nullable(),

  /** Whether the project is archived (hidden from active lists) */
  is_archived: z.boolean().default(false),

  /** UUID of the user who created the project */
  created_by: z.string().uuid(),

  /** Timestamp when project was created */
  created_at: z.string().datetime({ offset: true }),
});

/**
 * Project Member Schema - Entity schema for query responses
 *
 * Represents a user's membership in a project.
 */
export const ProjectMemberSchema = z.object({
  /** UUID primary key */
  id: z.string().uuid(),

  /** UUID of the project */
  project_id: z.string().uuid(),

  /** UUID of the member user */
  user_id: z.string().uuid(),

  /**
   * Member's role in the project
   * Uses the same role enum as workspace for consistency
   */
  role: WorkspaceRoleEnum.default('member'),

  /** Timestamp when user was added to the project */
  added_at: z.string().datetime({ offset: true }),
});

/**
 * Project Member With User Schema - Includes user details
 *
 * Used for displaying member lists with user information.
 */
export const ProjectMemberWithUserSchema = ProjectMemberSchema.extend({
  /** Associated user details */
  user: z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    name: z.string().nullable(),
  }),
});

/**
 * Project With Members Schema - Includes member list
 *
 * Used for project detail views with full member information.
 */
export const ProjectWithMembersSchema = ProjectSchema.extend({
  /** List of project members with user details */
  members: z.array(ProjectMemberWithUserSchema).optional(),

  /** Total time logged in seconds (aggregate) */
  total_time_seconds: z.number().int().nonnegative().optional(),

  /** Number of time entries for this project */
  entry_count: z.number().int().nonnegative().optional(),
});

/**
 * Project With Stats Schema - Includes aggregate statistics
 *
 * Used for project list views with summary data.
 */
export const ProjectWithStatsSchema = ProjectSchema.extend({
  /** Total number of members in the project */
  member_count: z.number().int().nonnegative().optional(),

  /** Total time logged in seconds */
  total_time_seconds: z.number().int().nonnegative().optional(),

  /** Whether the current user is a member */
  is_member: z.boolean().optional(),

  /** Current user's role in the project */
  current_user_role: WorkspaceRoleEnum.optional(),
});

// =============================================================================
// MUTATION SCHEMAS
// =============================================================================

/**
 * Create Project Schema - Mutation schema for creating new projects
 *
 * EXCLUDES server-managed fields: id, workspace_id, created_by, created_at
 * The workspace_id is provided via the active workspace context.
 * The creator is automatically added as the project owner.
 */
export const CreateProjectSchema = z.object({
  /** Project display name (1-100 characters) */
  name: z
    .string()
    .min(1, 'Project name is required')
    .max(100, 'Name must be 100 characters or less'),

  /**
   * Project color (optional, defaults to indigo)
   * Must be a valid hex color code
   */
  color: z
    .string()
    .regex(HEX_COLOR_REGEX, 'Color must be a valid hex color (e.g., #6366F1)')
    .optional(),

  /** Project description (optional, max 1000 characters) */
  description: z
    .string()
    .max(1000, 'Description must be 1000 characters or less')
    .nullable()
    .optional(),
});

/**
 * Update Project Schema - Mutation schema for updating project details
 *
 * EXCLUDES server-managed fields: id, workspace_id, created_by, created_at
 * All fields optional for partial updates.
 */
export const UpdateProjectSchema = z.object({
  /** Project display name (1-100 characters) */
  name: z
    .string()
    .min(1, 'Project name is required')
    .max(100, 'Name must be 100 characters or less')
    .optional(),

  /**
   * Project color
   * Must be a valid hex color code
   */
  color: z
    .string()
    .regex(HEX_COLOR_REGEX, 'Color must be a valid hex color (e.g., #6366F1)')
    .optional(),

  /** Project description (max 1000 characters) */
  description: z
    .string()
    .max(1000, 'Description must be 1000 characters or less')
    .nullable()
    .optional(),

  /** Whether the project is archived */
  is_archived: z.boolean().optional(),
});

/**
 * Add Project Member Schema - Input for adding a member to a project
 */
export const AddProjectMemberSchema = z.object({
  /** UUID of the user to add */
  user_id: z.string().uuid(),

  /** Role to assign (admin or member, not owner) */
  role: z.enum(['admin', 'member']).default('member'),
});

/**
 * Projects Filter Schema - For filtering projects in queries
 */
export const ProjectsFilterSchema = z.object({
  /** Search query to match against name and description */
  search: z.string().optional(),

  /** Filter by workspace ID (defaults to active workspace) */
  workspaceId: z.string().uuid().optional(),

  /** Include archived projects */
  includeArchived: z.boolean().default(false),

  /** Filter to only show projects the user is a member of */
  memberOnly: z.boolean().default(true),
});

// =============================================================================
// INFERRED TYPES
// =============================================================================

/** Project type */
export type Project = z.infer<typeof ProjectSchema>;

/** Project member type */
export type ProjectMember = z.infer<typeof ProjectMemberSchema>;

/** Project member with user details */
export type ProjectMemberWithUser = z.infer<typeof ProjectMemberWithUserSchema>;

/** Project with members */
export type ProjectWithMembers = z.infer<typeof ProjectWithMembersSchema>;

/** Project with stats */
export type ProjectWithStats = z.infer<typeof ProjectWithStatsSchema>;

/** Input type for creating projects */
export type CreateProjectInput = z.infer<typeof CreateProjectSchema>;

/** Input type for updating projects */
export type UpdateProjectInput = z.infer<typeof UpdateProjectSchema>;

/** Input type for adding project members */
export type AddProjectMemberInput = z.infer<typeof AddProjectMemberSchema>;

/** Input type for filtering projects */
export type ProjectsFilter = z.infer<typeof ProjectsFilterSchema>;
