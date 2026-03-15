/**
 * Workspace Invite Hooks
 *
 * This module provides TanStack Query hooks for managing workspace invitations.
 *
 * USAGE:
 * ```typescript
 * import {
 *   useWorkspaceInvites,
 *   useSendInvite,
 *   useAcceptInvite,
 *   usePendingInvitesForEmail
 * } from '@/hooks';
 *
 * function InviteList({ workspaceId }) {
 *   const { data: invites, isLoading } = useWorkspaceInvites(workspaceId);
 *   const sendInvite = useSendInvite();
 *
 *   return invites?.map(invite => (
 *     <InviteItem key={invite.id} invite={invite} />
 *   ));
 * }
 * ```
 *
 * SECURITY:
 * - RLS policies ensure only workspace admins can view/manage invites
 * - Invite tokens are hashed (SHA-256) before storage
 * - Raw tokens are only sent via email, never stored or returned
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { queryKeys } from '@/lib/queryClient';
import {
  WorkspaceInviteSchema,
  CreateInviteSchema,
  type WorkspaceInvite,
  type CreateInviteInput,
  type WorkspaceRole,
} from '@/schemas';
import { WorkspaceFetchError } from './useWorkspaces';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Edge function URL for sending invites */
const SEND_INVITE_FUNCTION_URL = 'send-workspace-invite';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Compute SHA-256 hash of a string
 * Used to hash invite tokens for database lookup
 */
async function sha256Hash(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// ============================================================================
// FETCH WORKSPACE INVITES
// ============================================================================

/**
 * Fetch all invites for a workspace (admin only)
 *
 * @param workspaceId - UUID of the workspace
 * @returns Promise<WorkspaceInvite[]> - Array of validated invites
 * @throws WorkspaceFetchError if the fetch fails
 */
export async function fetchWorkspaceInvites(workspaceId: string): Promise<WorkspaceInvite[]> {
  const { data, error } = await supabase
    .from('workspace_invites')
    .select('id, workspace_id, invited_email, role, invited_by, status, expires_at, created_at')
    .eq('workspace_id', workspaceId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) {
    throw new WorkspaceFetchError(error.message, error.code);
  }

  if (!data) {
    return [];
  }

  // Validate each invite against the schema
  const validInvites: WorkspaceInvite[] = [];
  for (const invite of data) {
    const parsed = WorkspaceInviteSchema.safeParse(invite);
    if (parsed.success) {
      validInvites.push(parsed.data);
    } else {
      console.warn('[useWorkspaceInvites] Invite failed validation:', parsed.error.flatten());
    }
  }

  return validInvites;
}

/**
 * Fetch pending invites for the current user's email
 * Used to show "pending invitations" banner
 *
 * @returns Promise<WorkspaceInvite[]> - Array of pending invites for user
 * @throws WorkspaceFetchError if the fetch fails
 */
export async function fetchPendingInvitesForEmail(): Promise<
  (WorkspaceInvite & { workspace: { id: string; name: string; slug: string } })[]
> {
  // Get current user's email
  const { data: sessionData } = await supabase.auth.getSession();
  const userEmail = sessionData.session?.user.email;

  if (!userEmail) {
    return [];
  }

  const { data, error } = await supabase
    .from('workspace_invites')
    .select(
      `
      id,
      workspace_id,
      invited_email,
      role,
      invited_by,
      status,
      expires_at,
      created_at,
      workspace:workspaces!workspace_invites_workspace_id_fkey (
        id,
        name,
        slug
      )
    `
    )
    .eq('invited_email', userEmail)
    .eq('status', 'pending')
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false });

  if (error) {
    throw new WorkspaceFetchError(error.message, error.code);
  }

  if (!data) {
    return [];
  }

  // Transform and validate
  const validInvites: (WorkspaceInvite & {
    workspace: { id: string; name: string; slug: string };
  })[] = [];
  for (const item of data) {
    const workspaceData = Array.isArray(item.workspace) ? item.workspace[0] : item.workspace;

    if (!workspaceData) continue;

    const inviteData = {
      id: item.id,
      workspace_id: item.workspace_id,
      invited_email: item.invited_email,
      role: item.role,
      invited_by: item.invited_by,
      status: item.status,
      expires_at: item.expires_at,
      created_at: item.created_at,
    };

    const parsed = WorkspaceInviteSchema.safeParse(inviteData);
    if (parsed.success) {
      validInvites.push({
        ...parsed.data,
        workspace: {
          id: workspaceData.id,
          name: workspaceData.name,
          slug: workspaceData.slug,
        },
      });
    }
  }

  return validInvites;
}

// ============================================================================
// QUERY HOOKS
// ============================================================================

/**
 * Options for the useWorkspaceInvites hook
 */
export interface UseWorkspaceInvitesOptions {
  /** Whether the query should be enabled */
  enabled?: boolean;
  /** Override the default stale time */
  staleTime?: number;
}

/**
 * Result type for useWorkspaceInvites hook
 */
export type UseWorkspaceInvitesResult = ReturnType<typeof useWorkspaceInvites>;

/**
 * Hook to fetch all invites for a workspace (admin only)
 *
 * @param workspaceId - UUID of the workspace
 * @param options - Optional configuration
 * @returns React Query result with invites data
 */
export function useWorkspaceInvites(workspaceId: string, options?: UseWorkspaceInvitesOptions) {
  const { enabled = true, staleTime } = options ?? {};

  return useQuery({
    queryKey: queryKeys.workspaceInvites(workspaceId),
    queryFn: () => fetchWorkspaceInvites(workspaceId),
    enabled: enabled && !!workspaceId,
    staleTime,
  });
}

/**
 * Options for the usePendingInvitesForEmail hook
 */
export interface UsePendingInvitesForEmailOptions {
  /** Whether the query should be enabled */
  enabled?: boolean;
  /** Override the default stale time */
  staleTime?: number;
}

/**
 * Result type for usePendingInvitesForEmail hook
 */
export type UsePendingInvitesForEmailResult = ReturnType<typeof usePendingInvitesForEmail>;

/**
 * Hook to fetch pending invites for the current user's email
 * Used to show "pending invitations" banner
 *
 * @param options - Optional configuration
 * @returns React Query result with pending invites
 */
export function usePendingInvitesForEmail(options?: UsePendingInvitesForEmailOptions) {
  const { enabled = true, staleTime } = options ?? {};

  return useQuery({
    queryKey: ['pendingInvitesForEmail'],
    queryFn: fetchPendingInvitesForEmail,
    enabled,
    staleTime,
  });
}

// ============================================================================
// SEND INVITE MUTATION
// ============================================================================

/**
 * Parameters for sending an invite
 */
export interface SendInviteParams extends CreateInviteInput {
  workspaceId: string;
}

/**
 * Send a workspace invitation via Edge Function
 *
 * @param params - Workspace ID and invite details
 * @returns Promise<{ success: boolean }> - Result of the operation
 * @throws WorkspaceFetchError if sending fails
 */
async function sendInvite({ workspaceId, email, role }: SendInviteParams): Promise<void> {
  // Validate input
  const validationResult = CreateInviteSchema.safeParse({ email, role });
  if (!validationResult.success) {
    throw new WorkspaceFetchError(
      `Validation failed: ${validationResult.error.message}`,
      'VALIDATION_ERROR',
      validationResult.error.flatten()
    );
  }

  // Call the Edge Function
  const { data, error } = await supabase.functions.invoke(SEND_INVITE_FUNCTION_URL, {
    body: {
      workspaceId,
      email: validationResult.data.email,
      role: validationResult.data.role,
    },
  });

  if (error) {
    throw new WorkspaceFetchError(error.message, 'FUNCTION_ERROR');
  }

  if (data?.error) {
    throw new WorkspaceFetchError(data.error, data.code || 'INVITE_ERROR');
  }
}

/**
 * Options for useSendInvite hook
 */
export interface UseSendInviteOptions {
  /** Callback invoked on successful send */
  onSuccess?: (params: SendInviteParams) => void;
  /** Callback invoked on error */
  onError?: (error: WorkspaceFetchError) => void;
}

/**
 * Result type for useSendInvite hook
 */
export type UseSendInviteResult = ReturnType<typeof useSendInvite>;

/**
 * Hook to send a workspace invitation
 *
 * Calls the send-workspace-invite Edge Function which:
 * - Validates user is admin/owner
 * - Generates secure token
 * - Stores hashed token in database
 * - Sends email via Resend
 *
 * @param options - Optional callbacks for success/error handling
 * @returns Mutation object with mutate/mutateAsync methods
 */
export function useSendInvite(options?: UseSendInviteOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: sendInvite,
    onSuccess: (_data, params) => {
      // Invalidate invites query to show new invite
      queryClient.invalidateQueries({ queryKey: queryKeys.workspaceInvites(params.workspaceId) });
      options?.onSuccess?.(params);
    },
    onError: (error: Error) => {
      const fetchError =
        error instanceof WorkspaceFetchError ? error : new WorkspaceFetchError(error.message);
      options?.onError?.(fetchError);
    },
  });
}

// ============================================================================
// ACCEPT INVITE MUTATION
// ============================================================================

/**
 * Parameters for accepting an invite
 */
export interface AcceptInviteParams {
  /** Raw token from the email link */
  token: string;
}

/**
 * Accept a workspace invitation
 *
 * @param params - The raw invitation token
 * @returns Promise<{ workspaceId: string }> - The workspace ID that was joined
 * @throws WorkspaceFetchError if acceptance fails
 */
async function acceptInvite({ token }: AcceptInviteParams): Promise<{ workspaceId: string }> {
  // Compute SHA-256 hash of token
  const tokenHash = await sha256Hash(token);

  // Get current user
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData.session?.user.id) {
    throw new WorkspaceFetchError('Not authenticated', 'UNAUTHORIZED');
  }

  const userId = sessionData.session.user.id;
  const userEmail = sessionData.session.user.email;

  // Find the invite by token hash
  const { data: invite, error: inviteError } = await supabase
    .from('workspace_invites')
    .select('id, workspace_id, invited_email, role, status, expires_at')
    .eq('token_hash', tokenHash)
    .single();

  if (inviteError || !invite) {
    throw new WorkspaceFetchError('Invalid or expired invitation', 'INVITE_NOT_FOUND');
  }

  // Validate invite status and expiry
  if (invite.status !== 'pending') {
    throw new WorkspaceFetchError('This invitation has already been used', 'INVITE_USED');
  }

  if (new Date(invite.expires_at) < new Date()) {
    throw new WorkspaceFetchError('This invitation has expired', 'INVITE_EXPIRED');
  }

  // Validate email matches (case-insensitive)
  if (invite.invited_email.toLowerCase() !== userEmail?.toLowerCase()) {
    throw new WorkspaceFetchError(
      'This invitation was sent to a different email address',
      'EMAIL_MISMATCH'
    );
  }

  // Check if user is already a member
  const { data: existingMember } = await supabase
    .from('workspace_members')
    .select('id')
    .eq('workspace_id', invite.workspace_id)
    .eq('user_id', userId)
    .single();

  if (existingMember) {
    // Update invite status and return existing workspace
    await supabase.from('workspace_invites').update({ status: 'accepted' }).eq('id', invite.id);

    return { workspaceId: invite.workspace_id };
  }

  // Create workspace member entry
  const { error: memberError } = await supabase.from('workspace_members').insert({
    workspace_id: invite.workspace_id,
    user_id: userId,
    role: invite.role as WorkspaceRole,
  });

  if (memberError) {
    throw new WorkspaceFetchError(
      `Failed to join workspace: ${memberError.message}`,
      memberError.code
    );
  }

  // Update invite status to accepted
  const { error: updateError } = await supabase
    .from('workspace_invites')
    .update({ status: 'accepted' })
    .eq('id', invite.id);

  if (updateError) {
    console.warn('[useWorkspaceInvites] Failed to update invite status:', updateError);
  }

  return { workspaceId: invite.workspace_id };
}

/**
 * Options for useAcceptInvite hook
 */
export interface UseAcceptInviteOptions {
  /** Callback invoked on successful acceptance */
  onSuccess?: (result: { workspaceId: string }) => void;
  /** Callback invoked on error */
  onError?: (error: WorkspaceFetchError) => void;
}

/**
 * Result type for useAcceptInvite hook
 */
export type UseAcceptInviteResult = ReturnType<typeof useAcceptInvite>;

/**
 * Hook to accept a workspace invitation
 *
 * Validates the token, checks expiry, creates membership, and updates invite status.
 *
 * @param options - Optional callbacks for success/error handling
 * @returns Mutation object with mutate/mutateAsync methods
 */
export function useAcceptInvite(options?: UseAcceptInviteOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: acceptInvite,
    onSuccess: result => {
      // Invalidate workspace queries to include new membership
      queryClient.invalidateQueries({ queryKey: queryKeys.workspaces });
      queryClient.invalidateQueries({ queryKey: queryKeys.workspace(result.workspaceId) });
      queryClient.invalidateQueries({ queryKey: ['pendingInvitesForEmail'] });
      options?.onSuccess?.(result);
    },
    onError: (error: Error) => {
      const fetchError =
        error instanceof WorkspaceFetchError ? error : new WorkspaceFetchError(error.message);
      options?.onError?.(fetchError);
    },
  });
}

// ============================================================================
// REVOKE INVITE MUTATION
// ============================================================================

/**
 * Parameters for revoking an invite
 */
export interface RevokeInviteParams {
  inviteId: string;
  workspaceId: string;
}

/**
 * Revoke (delete) a pending workspace invitation
 *
 * @param params - Invite ID and workspace ID
 * @returns Promise<void>
 * @throws WorkspaceFetchError if revocation fails
 */
async function revokeInvite({ inviteId }: RevokeInviteParams): Promise<void> {
  // RLS ensures user is admin/owner
  const { error } = await supabase.from('workspace_invites').delete().eq('id', inviteId);

  if (error) {
    throw new WorkspaceFetchError(error.message, error.code, error.details);
  }
}

/**
 * Options for useRevokeInvite hook
 */
export interface UseRevokeInviteOptions {
  /** Callback invoked on successful revocation */
  onSuccess?: (inviteId: string, workspaceId: string) => void;
  /** Callback invoked on error */
  onError?: (error: WorkspaceFetchError, inviteId: string) => void;
}

/**
 * Result type for useRevokeInvite hook
 */
export type UseRevokeInviteResult = ReturnType<typeof useRevokeInvite>;

/**
 * Hook to revoke (delete) a pending workspace invitation
 *
 * Requires admin or owner role.
 *
 * @param options - Optional callbacks for success/error handling
 * @returns Mutation object with mutate/mutateAsync methods
 */
export function useRevokeInvite(options?: UseRevokeInviteOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: revokeInvite,
    onMutate: async ({ inviteId, workspaceId }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.workspaceInvites(workspaceId) });

      // Snapshot previous values for rollback
      const previousInvites = queryClient.getQueryData<WorkspaceInvite[]>(
        queryKeys.workspaceInvites(workspaceId)
      );

      // Optimistically remove from cache
      if (previousInvites) {
        queryClient.setQueryData<WorkspaceInvite[]>(
          queryKeys.workspaceInvites(workspaceId),
          previousInvites.filter(i => i.id !== inviteId)
        );
      }

      return { previousInvites, workspaceId, inviteId };
    },
    onError: (error, { inviteId, workspaceId }, context) => {
      // Rollback optimistic update on error
      if (context?.previousInvites && context?.workspaceId) {
        queryClient.setQueryData(
          queryKeys.workspaceInvites(context.workspaceId),
          context.previousInvites
        );
      }

      const fetchError =
        error instanceof WorkspaceFetchError ? error : new WorkspaceFetchError(error.message);
      options?.onError?.(fetchError, inviteId);
    },
    onSuccess: (_data, { inviteId, workspaceId }) => {
      // Invalidate to ensure cache consistency
      queryClient.invalidateQueries({ queryKey: queryKeys.workspaceInvites(workspaceId) });
      options?.onSuccess?.(inviteId, workspaceId);
    },
  });
}

// ============================================================================
// DECLINE INVITE MUTATION (for invitees)
// ============================================================================

/**
 * Parameters for declining an invite
 */
export interface DeclineInviteParams {
  inviteId: string;
}

/**
 * Decline a workspace invitation (for invitees)
 *
 * @param params - Invite ID
 * @returns Promise<void>
 * @throws WorkspaceFetchError if decline fails
 */
async function declineInvite({ inviteId }: DeclineInviteParams): Promise<void> {
  // Get current user's email
  const { data: sessionData } = await supabase.auth.getSession();
  const userEmail = sessionData.session?.user.email;

  if (!userEmail) {
    throw new WorkspaceFetchError('Not authenticated', 'UNAUTHORIZED');
  }

  // Verify the invite belongs to this user
  const { data: invite, error: fetchError } = await supabase
    .from('workspace_invites')
    .select('invited_email')
    .eq('id', inviteId)
    .single();

  if (fetchError || !invite) {
    throw new WorkspaceFetchError('Invite not found', 'NOT_FOUND');
  }

  if (invite.invited_email.toLowerCase() !== userEmail.toLowerCase()) {
    throw new WorkspaceFetchError('Not authorized to decline this invite', 'UNAUTHORIZED');
  }

  // Delete the invite
  const { error } = await supabase.from('workspace_invites').delete().eq('id', inviteId);

  if (error) {
    throw new WorkspaceFetchError(error.message, error.code, error.details);
  }
}

/**
 * Options for useDeclineInvite hook
 */
export interface UseDeclineInviteOptions {
  /** Callback invoked on successful decline */
  onSuccess?: (inviteId: string) => void;
  /** Callback invoked on error */
  onError?: (error: WorkspaceFetchError, inviteId: string) => void;
}

/**
 * Result type for useDeclineInvite hook
 */
export type UseDeclineInviteResult = ReturnType<typeof useDeclineInvite>;

/**
 * Hook to decline a workspace invitation
 *
 * For invitees to reject an invitation. Deletes the invite.
 *
 * @param options - Optional callbacks for success/error handling
 * @returns Mutation object with mutate/mutateAsync methods
 */
export function useDeclineInvite(options?: UseDeclineInviteOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: declineInvite,
    onSuccess: (_data, { inviteId }) => {
      // Invalidate pending invites query
      queryClient.invalidateQueries({ queryKey: ['pendingInvitesForEmail'] });
      options?.onSuccess?.(inviteId);
    },
    onError: (error: Error, { inviteId }) => {
      const fetchError =
        error instanceof WorkspaceFetchError ? error : new WorkspaceFetchError(error.message);
      options?.onError?.(fetchError, inviteId);
    },
  });
}
