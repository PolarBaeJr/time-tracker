import { z } from 'zod';

/**
 * Approval Schemas - Validation schemas for time entry approval workflow
 *
 * Members submit time entries to a designated approver.
 * Approvers review and approve/reject entries.
 * Entries are only visible to the submitter and their designated approver (plus Admins/Owner).
 */

// =============================================================================
// ENUMS
// =============================================================================

/**
 * Approval status enum - matches database approval_status ENUM
 * - draft: Entry not yet submitted for approval
 * - submitted: Entry submitted and awaiting review
 * - approved: Entry approved by approver
 * - rejected: Entry rejected by approver (requires note)
 */
export const ApprovalStatusEnum = z.enum(['draft', 'submitted', 'approved', 'rejected']);

// =============================================================================
// ENTITY SCHEMAS
// =============================================================================

/**
 * Approval Assignment Schema - Entity schema for query responses
 *
 * Represents the mapping of a member to their designated approver.
 * A member can have at most one approver per workspace.
 */
export const ApprovalAssignmentSchema = z.object({
  /** UUID primary key */
  id: z.string().uuid(),

  /** UUID of the workspace */
  workspace_id: z.string().uuid(),

  /** UUID of the member user whose entries will be reviewed */
  member_user_id: z.string().uuid(),

  /** UUID of the approver user who will review entries */
  approver_user_id: z.string().uuid(),

  /** UUID of the admin/owner who created this assignment */
  created_by: z.string().uuid(),

  /** Timestamp when assignment was created */
  created_at: z.string().datetime({ offset: true }),
});

/**
 * Approval Assignment With Users Schema - Includes user details
 *
 * Used for displaying assignments in admin views.
 */
export const ApprovalAssignmentWithUsersSchema = ApprovalAssignmentSchema.extend({
  /** Member user details */
  member: z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    name: z.string().nullable(),
  }),

  /** Approver user details */
  approver: z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    name: z.string().nullable(),
  }),
});

/**
 * Time Entry With Approval Schema - Time entry with approval fields
 *
 * Extends the base time entry with approval-specific fields.
 * Used for displaying entries in approval queues.
 */
export const TimeEntryWithApprovalSchema = z.object({
  /** UUID primary key */
  id: z.string().uuid(),

  /** UUID of the owning user */
  user_id: z.string().uuid(),

  /** UUID of the associated category (nullable) */
  category_id: z.string().uuid().nullable(),

  /** Start timestamp */
  start_at: z.string().datetime({ offset: true }),

  /** End timestamp (nullable for ongoing entries) */
  end_at: z.string().datetime({ offset: true }).nullable(),

  /** Duration in seconds */
  duration_seconds: z.number().int().nonnegative(),

  /** Notes/description */
  notes: z.string().max(1000).nullable(),

  /** Entry type */
  entry_type: z.enum(['work', 'break', 'long_break']).default('work'),

  /** Whether billable */
  is_billable: z.boolean().default(false),

  /** Created timestamp */
  created_at: z.string().datetime({ offset: true }),

  /** Updated timestamp */
  updated_at: z.string().datetime({ offset: true }),

  // Approval-specific fields
  /** UUID of the associated project (nullable) */
  project_id: z.string().uuid().nullable().optional(),

  /** Current approval status */
  approval_status: ApprovalStatusEnum.default('draft'),

  /** UUID of the designated approver */
  approver_id: z.string().uuid().nullable().optional(),

  /** Note from approver (required for rejections) */
  approval_note: z.string().max(500).nullable().optional(),

  /** Timestamp when approved/rejected */
  approved_at: z.string().datetime({ offset: true }).nullable().optional(),

  /** Timestamp when submitted for approval */
  submitted_at: z.string().datetime({ offset: true }).nullable().optional(),
});

/**
 * Time Entry With Approval And User Schema - Includes user details
 *
 * Used in approval queues to show who submitted the entry.
 */
export const TimeEntryWithApprovalAndUserSchema = TimeEntryWithApprovalSchema.extend({
  /** Submitter user details */
  user: z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    name: z.string().nullable(),
  }),

  /** Category details (if linked) */
  category: z
    .object({
      id: z.string().uuid(),
      name: z.string(),
      color: z.string(),
    })
    .nullable()
    .optional(),

  /** Project details (if linked) */
  project: z
    .object({
      id: z.string().uuid(),
      name: z.string(),
      color: z.string(),
    })
    .nullable()
    .optional(),
});

/**
 * Approval Summary Schema - Aggregate approval statistics
 *
 * Used for dashboard widgets and overview screens.
 */
export const ApprovalSummarySchema = z.object({
  /** Number of entries pending approval (for approvers) */
  pending_count: z.number().int().nonnegative(),

  /** Number of entries the user has submitted awaiting approval */
  submitted_count: z.number().int().nonnegative(),

  /** Number of entries approved this period */
  approved_count: z.number().int().nonnegative(),

  /** Number of entries rejected this period */
  rejected_count: z.number().int().nonnegative(),
});

// =============================================================================
// MUTATION SCHEMAS
// =============================================================================

/**
 * Create Approval Assignment Schema - Input for creating member-approver assignments
 *
 * EXCLUDES server-managed fields: id, workspace_id, created_by, created_at
 * Used by admins/owners to set up approval workflows.
 */
export const CreateApprovalAssignmentSchema = z
  .object({
    /** UUID of the member user whose entries will be reviewed */
    member_user_id: z.string().uuid(),

    /** UUID of the approver user who will review entries */
    approver_user_id: z.string().uuid(),
  })
  .refine(data => data.member_user_id !== data.approver_user_id, {
    message: 'A member cannot be their own approver',
    path: ['approver_user_id'],
  });

/**
 * Submit Entries Input Schema - Input for submitting entries for approval
 *
 * Members select a date range or specific entries to submit.
 */
export const SubmitEntriesInputSchema = z.object({
  /** Array of time entry UUIDs to submit */
  entry_ids: z.array(z.string().uuid()).min(1, 'At least one entry is required'),
});

/**
 * Approve Entries Input Schema - Input for approving entries
 *
 * Approvers can approve multiple entries at once with an optional note.
 */
export const ApproveEntriesInputSchema = z.object({
  /** Array of time entry UUIDs to approve */
  entry_ids: z.array(z.string().uuid()).min(1, 'At least one entry is required'),

  /** Optional note from approver */
  approval_note: z.string().max(500, 'Note must be 500 characters or less').optional(),
});

/**
 * Reject Entries Input Schema - Input for rejecting entries
 *
 * Approvers must provide a reason when rejecting entries.
 */
export const RejectEntriesInputSchema = z.object({
  /** Array of time entry UUIDs to reject */
  entry_ids: z.array(z.string().uuid()).min(1, 'At least one entry is required'),

  /** Required note explaining rejection reason */
  approval_note: z
    .string()
    .min(1, 'A rejection reason is required')
    .max(500, 'Note must be 500 characters or less'),
});

/**
 * Approval Filter Schema - For filtering entries in approval views
 */
export const ApprovalFilterSchema = z.object({
  /** Filter by status */
  status: ApprovalStatusEnum.optional(),

  /** Filter by workspace ID */
  workspaceId: z.string().uuid().optional(),

  /** Filter by member user ID (for approvers viewing submissions) */
  memberId: z.string().uuid().optional(),

  /** Date range start */
  dateStart: z.string().datetime({ offset: true }).optional(),

  /** Date range end */
  dateEnd: z.string().datetime({ offset: true }).optional(),
});

// =============================================================================
// INFERRED TYPES
// =============================================================================

/** Approval status type */
export type ApprovalStatus = z.infer<typeof ApprovalStatusEnum>;

/** Approval assignment type */
export type ApprovalAssignment = z.infer<typeof ApprovalAssignmentSchema>;

/** Approval assignment with user details */
export type ApprovalAssignmentWithUsers = z.infer<typeof ApprovalAssignmentWithUsersSchema>;

/** Time entry with approval fields */
export type TimeEntryWithApproval = z.infer<typeof TimeEntryWithApprovalSchema>;

/** Time entry with approval and user details */
export type TimeEntryWithApprovalAndUser = z.infer<typeof TimeEntryWithApprovalAndUserSchema>;

/** Approval summary */
export type ApprovalSummary = z.infer<typeof ApprovalSummarySchema>;

/** Input type for creating approval assignments */
export type CreateApprovalAssignmentInput = z.infer<typeof CreateApprovalAssignmentSchema>;

/** Input type for submitting entries */
export type SubmitEntriesInput = z.infer<typeof SubmitEntriesInputSchema>;

/** Input type for approving entries */
export type ApproveEntriesInput = z.infer<typeof ApproveEntriesInputSchema>;

/** Input type for rejecting entries */
export type RejectEntriesInput = z.infer<typeof RejectEntriesInputSchema>;

/** Input type for filtering approval entries */
export type ApprovalFilter = z.infer<typeof ApprovalFilterSchema>;
