/**
 * Edge Function: send-workspace-invite
 *
 * Sends workspace invitation emails with secure tokens.
 * Only workspace admins/owners can send invites.
 *
 * Authentication: Requires valid Supabase JWT
 * Method: POST
 * Body: { workspaceId: string, email: string, role: 'admin' | 'member' }
 * Returns: { success: boolean, inviteId: string } or { error: string }
 *
 * Security:
 * - Only workspace admin/owner can send invites
 * - Token is generated with crypto.randomUUID()
 * - Only SHA-256 hash is stored in database
 * - Raw token is sent via email (never stored)
 * - Rate limited: max 10 pending invites per hour per workspace
 *
 * Environment variables:
 * - RESEND_API_KEY: API key for Resend email service
 * - APP_URL: Base URL for accept invite link
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  corsHeaders,
  handleCorsPreflightRequest,
  jsonResponse,
  errorResponse,
} from '../_shared/cors.ts';

// =============================================================================
// CONSTANTS
// =============================================================================

const INVITE_CONFIG = {
  MAX_PENDING_PER_HOUR: 10,
  EXPIRY_DAYS: 7,
} as const;

// Email regex from workspace_invites table constraint
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

// UUID regex for validation
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// =============================================================================
// TYPES
// =============================================================================

interface SendInviteRequest {
  workspaceId: string;
  email: string;
  role: 'admin' | 'member';
}

interface Workspace {
  id: string;
  name: string;
  slug: string;
}

interface WorkspaceMember {
  user_id: string;
  role: 'owner' | 'admin' | 'member';
}

// =============================================================================
// VALIDATION
// =============================================================================

/**
 * Validate and parse request body
 */
function validateRequestBody(body: unknown): SendInviteRequest | { error: string } {
  if (!body || typeof body !== 'object') {
    return { error: 'Invalid request body' };
  }

  const { workspaceId, email, role } = body as Record<string, unknown>;

  // Validate workspaceId
  if (!workspaceId || typeof workspaceId !== 'string') {
    return { error: 'Missing or invalid workspaceId' };
  }
  if (!UUID_REGEX.test(workspaceId)) {
    return { error: 'Invalid workspaceId format (must be UUID)' };
  }

  // Validate email
  if (!email || typeof email !== 'string') {
    return { error: 'Missing or invalid email' };
  }
  const normalizedEmail = email.toLowerCase().trim();
  if (!EMAIL_REGEX.test(normalizedEmail)) {
    return { error: 'Invalid email format' };
  }

  // Validate role
  if (!role || typeof role !== 'string') {
    return { error: 'Missing or invalid role' };
  }
  if (role !== 'admin' && role !== 'member') {
    return { error: 'Role must be "admin" or "member"' };
  }

  return {
    workspaceId,
    email: normalizedEmail,
    role,
  };
}

// =============================================================================
// CRYPTO HELPERS
// =============================================================================

/**
 * Generate SHA-256 hash of a string
 */
async function sha256Hash(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// =============================================================================
// EMAIL HELPERS
// =============================================================================

/**
 * Send invite email via Resend API
 */
async function sendInviteEmail(
  toEmail: string,
  workspaceName: string,
  inviterName: string,
  acceptLink: string,
  expiryDate: Date
): Promise<{ success: boolean; error?: string }> {
  const resendApiKey = Deno.env.get('RESEND_API_KEY');

  if (!resendApiKey) {
    console.error('RESEND_API_KEY not configured');
    return { success: false, error: 'Email service not configured' };
  }

  const formattedExpiry = expiryDate.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Workspace Invitation</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px;">You're Invited!</h1>
  </div>

  <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
    <p style="font-size: 16px; margin-bottom: 20px;">
      <strong>${escapeHtml(inviterName)}</strong> has invited you to join the workspace <strong>"${escapeHtml(workspaceName)}"</strong> on WorkTracker.
    </p>

    <p style="font-size: 14px; color: #666; margin-bottom: 25px;">
      Join the team to collaborate on time tracking, projects, and more.
    </p>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${acceptLink}" style="display: inline-block; background: #6366F1; color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
        Accept Invitation
      </a>
    </div>

    <p style="font-size: 13px; color: #888; margin-top: 25px;">
      This invitation expires on ${formattedExpiry}. If you didn't expect this invitation, you can safely ignore this email.
    </p>

    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 25px 0;">

    <p style="font-size: 12px; color: #aaa; text-align: center;">
      If the button doesn't work, copy and paste this link into your browser:<br>
      <a href="${acceptLink}" style="color: #6366F1; word-break: break-all;">${acceptLink}</a>
    </p>
  </div>

  <div style="text-align: center; padding: 20px; color: #888; font-size: 12px;">
    <p>Sent by <a href="${Deno.env.get('APP_URL') || 'https://worktracker.app'}" style="color: #6366F1; text-decoration: none;">WorkTracker</a></p>
  </div>
</body>
</html>
`;

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: 'WorkTracker <invites@worktracker.app>',
        to: [toEmail],
        subject: `You've been invited to join "${workspaceName}" on WorkTracker`,
        html: htmlBody,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Resend API error:', errorText);
      return { success: false, error: 'Failed to send email' };
    }

    return { success: true };
  } catch (error) {
    console.error('Email sending error:', error);
    return { success: false, error: 'Failed to send email' };
  }
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// =============================================================================
// MAIN HANDLER
// =============================================================================

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return handleCorsPreflightRequest();
  }

  // Only allow POST
  if (req.method !== 'POST') {
    return errorResponse('Method not allowed', 405);
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return errorResponse('Missing authorization header', 401);
    }

    // Create Supabase client with user's auth token
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    // Get the authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse('Unauthorized', 401);
    }

    // Parse and validate request body
    const body = await req.json();
    const validation = validateRequestBody(body);

    if ('error' in validation) {
      return errorResponse(validation.error, 400);
    }

    const { workspaceId, email, role } = validation;

    // Get user's name for the invite email
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('name, email')
      .eq('id', user.id)
      .single();

    if (userError || !userData) {
      return errorResponse('Failed to fetch user data', 500);
    }

    const inviterName = userData.name || userData.email || 'A team member';

    // Verify user is admin/owner of the workspace
    const { data: membership, error: membershipError } = await supabase
      .from('workspace_members')
      .select('user_id, role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .single();

    if (membershipError || !membership) {
      return errorResponse('Workspace not found or access denied', 404);
    }

    const typedMembership = membership as WorkspaceMember;

    if (typedMembership.role !== 'owner' && typedMembership.role !== 'admin') {
      return errorResponse('Only workspace admins can send invites', 403);
    }

    // Get workspace details
    const { data: workspace, error: workspaceError } = await supabase
      .from('workspaces')
      .select('id, name, slug')
      .eq('id', workspaceId)
      .single();

    if (workspaceError || !workspace) {
      return errorResponse('Workspace not found', 404);
    }

    const typedWorkspace = workspace as Workspace;

    // Check if email is already a member
    const { data: existingMembers, error: existingMembersError } = await supabase
      .from('users')
      .select('id, email')
      .eq('email', email);

    if (!existingMembersError && existingMembers && existingMembers.length > 0) {
      const existingUserId = existingMembers[0].id;

      // Check if already a workspace member
      const { data: existingMembership } = await supabase
        .from('workspace_members')
        .select('id')
        .eq('workspace_id', workspaceId)
        .eq('user_id', existingUserId)
        .single();

      if (existingMembership) {
        return errorResponse('This user is already a member of the workspace', 400);
      }
    }

    // Check for existing pending invite
    const { data: existingInvites, error: existingInvitesError } = await supabase
      .from('workspace_invites')
      .select('id, expires_at')
      .eq('workspace_id', workspaceId)
      .eq('invited_email', email)
      .eq('status', 'pending');

    if (!existingInvitesError && existingInvites && existingInvites.length > 0) {
      const validInvites = existingInvites.filter(
        invite => new Date(invite.expires_at) > new Date()
      );
      if (validInvites.length > 0) {
        return errorResponse('A pending invitation already exists for this email', 400);
      }
    }

    // Rate limiting: Check pending invites count in last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    const { data: recentInvites, error: recentInvitesError } = await supabase
      .from('workspace_invites')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('invited_by', user.id)
      .gte('created_at', oneHourAgo);

    if (!recentInvitesError && recentInvites) {
      if (recentInvites.length >= INVITE_CONFIG.MAX_PENDING_PER_HOUR) {
        return jsonResponse(
          {
            error: `Rate limit exceeded. Maximum ${INVITE_CONFIG.MAX_PENDING_PER_HOUR} invites per hour.`,
            retryAfter: 3600,
          },
          429
        );
      }
    }

    // Generate secure token
    const rawToken = crypto.randomUUID();
    const tokenHash = await sha256Hash(rawToken);

    // Calculate expiry date
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + INVITE_CONFIG.EXPIRY_DAYS);

    // Insert invite record
    const { data: invite, error: insertError } = await supabase
      .from('workspace_invites')
      .insert({
        workspace_id: workspaceId,
        invited_email: email,
        role: role,
        invited_by: user.id,
        token_hash: tokenHash,
        status: 'pending',
        expires_at: expiresAt.toISOString(),
      })
      .select('id')
      .single();

    if (insertError || !invite) {
      console.error('Failed to create invite:', insertError);
      return errorResponse('Failed to create invitation', 500);
    }

    // Generate accept link
    const appUrl = Deno.env.get('APP_URL') || 'https://worktracker.app';
    const acceptLink = `${appUrl}/invite/accept?token=${rawToken}`;

    // Send email
    const emailResult = await sendInviteEmail(
      email,
      typedWorkspace.name,
      inviterName,
      acceptLink,
      expiresAt
    );

    if (!emailResult.success) {
      // Delete the invite if email failed
      await supabase.from('workspace_invites').delete().eq('id', invite.id);

      return errorResponse(emailResult.error || 'Failed to send invitation email', 500);
    }

    // Success response (never expose raw token in response)
    return jsonResponse({
      success: true,
      inviteId: invite.id,
      message: `Invitation sent to ${email}`,
    });
  } catch (error) {
    console.error('Send invite error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return errorResponse(`Failed to send invitation: ${message}`, 500);
  }
});
