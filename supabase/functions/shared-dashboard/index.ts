/**
 * Edge Function: shared-dashboard
 *
 * Returns read-only analytics data for a shared dashboard.
 * No authentication required - this is a public endpoint.
 * Only returns data for active, non-expired shared dashboards.
 *
 * Method: GET
 * Path: /shared-dashboard?token={token} or /shared-dashboard/{token}
 * Returns: SharedDashboardData with analytics (no individual entries)
 *
 * Error Handling:
 * - 400: Invalid token format
 * - 404: Dashboard not found or inactive
 * - 410: Dashboard expired
 *
 * SECURITY:
 * - Only exposes aggregate statistics, NEVER individual entries
 * - No PII exposed (user email, entry notes, etc.)
 * - Validates token format (UUID)
 * - Checks is_active flag and expires_at
 */

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  corsHeaders,
  handleCorsPreflightRequest,
  jsonResponse,
  errorResponse,
} from '../_shared/cors.ts';

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * UUID format regex for token validation
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Number of days to fetch for daily totals
 */
const DAILY_TOTALS_DAYS = 30;

/**
 * Maximum number of top projects to return (for workspace dashboards)
 */
const MAX_TOP_PROJECTS = 10;

// =============================================================================
// TYPES
// =============================================================================

interface SharedDashboardRow {
  id: string;
  user_id: string;
  workspace_id: string | null;
  token: string;
  title: string;
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
}

interface UserRow {
  id: string;
  name: string | null;
  email: string;
}

interface DailyTotal {
  date: string;
  total_seconds: number;
}

interface CategoryBreakdown {
  category_id: string | null;
  category_name: string;
  category_color: string;
  total_seconds: number;
  percentage: number;
}

interface TopProject {
  project_id: string;
  project_name: string;
  project_color: string;
  total_seconds: number;
  percentage: number;
}

interface DateRange {
  start: string;
  end: string;
}

interface Summary {
  total_hours_week: number;
  total_hours_month: number;
  avg_hours_per_day: number;
  days_tracked: number;
}

interface SharedDashboardData {
  title: string;
  owner_name: string | null;
  is_workspace: boolean;
  workspace_name: string | null;
  date_range: DateRange;
  summary: Summary;
  daily_totals: DailyTotal[];
  category_breakdown: CategoryBreakdown[];
  top_projects?: TopProject[];
  generated_at: string;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Extract token from request URL
 * Supports both query param (?token=foo) and path (/shared-dashboard/foo)
 */
function extractTokenFromRequest(req: Request): string | null {
  const url = new URL(req.url);

  // Try query parameter first
  const queryToken = url.searchParams.get('token');
  if (queryToken) {
    return queryToken;
  }

  // Try path parameter (e.g., /shared-dashboard/foo)
  const pathParts = url.pathname.split('/').filter(Boolean);
  if (pathParts.length >= 2) {
    // Last part after "shared-dashboard"
    const tokenIndex = pathParts.indexOf('shared-dashboard');
    if (tokenIndex !== -1 && tokenIndex < pathParts.length - 1) {
      return pathParts[tokenIndex + 1];
    }
  }

  return null;
}

/**
 * Validate token format (UUID)
 */
function isValidToken(token: string): boolean {
  return UUID_REGEX.test(token);
}

/**
 * Get date N days ago in YYYY-MM-DD format (UTC)
 */
function getDateDaysAgo(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().split('T')[0];
}

/**
 * Get start of current week (Sunday) in ISO format
 */
function getWeekStartDate(): string {
  const now = new Date();
  const dayOfWeek = now.getUTCDay(); // 0 = Sunday
  const startOfWeek = new Date(now);
  startOfWeek.setUTCDate(now.getUTCDate() - dayOfWeek);
  startOfWeek.setUTCHours(0, 0, 0, 0);
  return startOfWeek.toISOString();
}

/**
 * Get start of current month in ISO format
 */
function getMonthStartDate(): string {
  const now = new Date();
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  return startOfMonth.toISOString();
}

/**
 * Convert seconds to hours (rounded to 2 decimal places)
 */
function secondsToHours(seconds: number): number {
  return Math.round((seconds / 3600) * 100) / 100;
}

// =============================================================================
// DATA FETCHING FUNCTIONS
// =============================================================================

/**
 * Fetch daily totals for the past N days
 */
async function fetchDailyTotals(
  supabase: SupabaseClient,
  userId: string,
  workspaceId: string | null,
  days: number
): Promise<DailyTotal[]> {
  const startDate = getDateDaysAgo(days);
  const endDate = new Date().toISOString().split('T')[0];

  let query;

  if (workspaceId) {
    // Workspace dashboard: fetch entries linked to projects in this workspace
    query = supabase
      .from('time_entries')
      .select(
        `
        start_at,
        duration_seconds,
        project_id,
        projects!inner(workspace_id)
      `
      )
      .eq('projects.workspace_id', workspaceId)
      .gte('start_at', `${startDate}T00:00:00Z`)
      .lte('start_at', `${endDate}T23:59:59Z`);
  } else {
    // Personal dashboard: fetch user's entries
    query = supabase
      .from('time_entries')
      .select('start_at, duration_seconds')
      .eq('user_id', userId)
      .gte('start_at', `${startDate}T00:00:00Z`)
      .lte('start_at', `${endDate}T23:59:59Z`);
  }

  const { data: entries, error } = await query;

  if (error) {
    console.error('Error fetching daily totals:', error);
    throw new Error('Failed to fetch daily totals');
  }

  // Aggregate by date
  const dailyMap = new Map<string, number>();

  // Initialize all days with 0
  for (let i = days; i >= 0; i--) {
    const date = getDateDaysAgo(i);
    dailyMap.set(date, 0);
  }

  // Sum up entries by date
  for (const entry of entries || []) {
    const date = new Date(entry.start_at).toISOString().split('T')[0];
    const current = dailyMap.get(date) || 0;
    dailyMap.set(date, current + (entry.duration_seconds || 0));
  }

  // Convert to array
  return Array.from(dailyMap.entries())
    .map(([date, total_seconds]) => ({ date, total_seconds }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Fetch category breakdown for the past N days
 */
async function fetchCategoryBreakdown(
  supabase: SupabaseClient,
  userId: string,
  workspaceId: string | null,
  days: number
): Promise<CategoryBreakdown[]> {
  const startDate = getDateDaysAgo(days);

  let query;

  if (workspaceId) {
    // Workspace dashboard
    query = supabase
      .from('time_entries')
      .select(
        `
        duration_seconds,
        category_id,
        categories(id, name, color),
        projects!inner(workspace_id)
      `
      )
      .eq('projects.workspace_id', workspaceId)
      .gte('start_at', `${startDate}T00:00:00Z`);
  } else {
    // Personal dashboard
    query = supabase
      .from('time_entries')
      .select(
        `
        duration_seconds,
        category_id,
        categories(id, name, color)
      `
      )
      .eq('user_id', userId)
      .gte('start_at', `${startDate}T00:00:00Z`);
  }

  const { data: entries, error } = await query;

  if (error) {
    console.error('Error fetching category breakdown:', error);
    throw new Error('Failed to fetch category breakdown');
  }

  // Aggregate by category
  const categoryMap = new Map<
    string | null,
    {
      category_id: string | null;
      category_name: string;
      category_color: string;
      total_seconds: number;
    }
  >();

  let totalSeconds = 0;

  for (const entry of entries || []) {
    const categoryId = entry.category_id;
    const category = entry.categories as { id: string; name: string; color: string } | null;

    const key = categoryId ?? 'uncategorized';
    const existing = categoryMap.get(key);

    const seconds = entry.duration_seconds || 0;
    totalSeconds += seconds;

    if (existing) {
      existing.total_seconds += seconds;
    } else {
      categoryMap.set(key, {
        category_id: categoryId,
        category_name: category?.name ?? 'Uncategorized',
        category_color: category?.color ?? '#6B7280',
        total_seconds: seconds,
      });
    }
  }

  // Convert to array with percentages
  return Array.from(categoryMap.values())
    .map(cat => ({
      ...cat,
      percentage: totalSeconds > 0 ? Math.round((cat.total_seconds / totalSeconds) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.total_seconds - a.total_seconds);
}

/**
 * Fetch top projects for workspace dashboard
 */
async function fetchTopProjects(
  supabase: SupabaseClient,
  workspaceId: string,
  days: number
): Promise<TopProject[]> {
  const startDate = getDateDaysAgo(days);

  const { data: entries, error } = await supabase
    .from('time_entries')
    .select(
      `
      duration_seconds,
      project_id,
      projects!inner(id, name, color, workspace_id)
    `
    )
    .eq('projects.workspace_id', workspaceId)
    .gte('start_at', `${startDate}T00:00:00Z`);

  if (error) {
    console.error('Error fetching top projects:', error);
    throw new Error('Failed to fetch top projects');
  }

  // Aggregate by project
  const projectMap = new Map<
    string,
    {
      project_id: string;
      project_name: string;
      project_color: string;
      total_seconds: number;
    }
  >();

  let totalSeconds = 0;

  for (const entry of entries || []) {
    const project = entry.projects as {
      id: string;
      name: string;
      color: string;
      workspace_id: string;
    } | null;
    if (!project || !entry.project_id) continue;

    const seconds = entry.duration_seconds || 0;
    totalSeconds += seconds;

    const existing = projectMap.get(entry.project_id);
    if (existing) {
      existing.total_seconds += seconds;
    } else {
      projectMap.set(entry.project_id, {
        project_id: project.id,
        project_name: project.name,
        project_color: project.color,
        total_seconds: seconds,
      });
    }
  }

  // Convert to array with percentages, take top N
  return Array.from(projectMap.values())
    .map(proj => ({
      ...proj,
      percentage:
        totalSeconds > 0 ? Math.round((proj.total_seconds / totalSeconds) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.total_seconds - a.total_seconds)
    .slice(0, MAX_TOP_PROJECTS);
}

/**
 * Calculate summary statistics
 */
async function fetchSummary(
  supabase: SupabaseClient,
  userId: string,
  workspaceId: string | null
): Promise<Summary> {
  const weekStart = getWeekStartDate();
  const monthStart = getMonthStartDate();
  const thirtyDaysAgo = `${getDateDaysAgo(30)}T00:00:00Z`;

  // Fetch this week's total
  let weekQuery;
  let monthQuery;
  let thirtyDaysQuery;

  if (workspaceId) {
    weekQuery = supabase
      .from('time_entries')
      .select('duration_seconds, projects!inner(workspace_id)')
      .eq('projects.workspace_id', workspaceId)
      .gte('start_at', weekStart);

    monthQuery = supabase
      .from('time_entries')
      .select('duration_seconds, projects!inner(workspace_id)')
      .eq('projects.workspace_id', workspaceId)
      .gte('start_at', monthStart);

    thirtyDaysQuery = supabase
      .from('time_entries')
      .select('start_at, duration_seconds, projects!inner(workspace_id)')
      .eq('projects.workspace_id', workspaceId)
      .gte('start_at', thirtyDaysAgo);
  } else {
    weekQuery = supabase
      .from('time_entries')
      .select('duration_seconds')
      .eq('user_id', userId)
      .gte('start_at', weekStart);

    monthQuery = supabase
      .from('time_entries')
      .select('duration_seconds')
      .eq('user_id', userId)
      .gte('start_at', monthStart);

    thirtyDaysQuery = supabase
      .from('time_entries')
      .select('start_at, duration_seconds')
      .eq('user_id', userId)
      .gte('start_at', thirtyDaysAgo);
  }

  const [weekResult, monthResult, thirtyDaysResult] = await Promise.all([
    weekQuery,
    monthQuery,
    thirtyDaysQuery,
  ]);

  if (weekResult.error || monthResult.error || thirtyDaysResult.error) {
    console.error(
      'Error fetching summary:',
      weekResult.error || monthResult.error || thirtyDaysResult.error
    );
    throw new Error('Failed to fetch summary');
  }

  // Calculate totals
  const weekSeconds = (weekResult.data || []).reduce(
    (sum, e) => sum + (e.duration_seconds || 0),
    0
  );
  const monthSeconds = (monthResult.data || []).reduce(
    (sum, e) => sum + (e.duration_seconds || 0),
    0
  );
  const thirtyDaysSeconds = (thirtyDaysResult.data || []).reduce(
    (sum, e) => sum + (e.duration_seconds || 0),
    0
  );

  // Count unique days with entries
  const uniqueDays = new Set(
    (thirtyDaysResult.data || []).map(e => new Date(e.start_at).toISOString().split('T')[0])
  );

  return {
    total_hours_week: secondsToHours(weekSeconds),
    total_hours_month: secondsToHours(monthSeconds),
    avg_hours_per_day:
      uniqueDays.size > 0 ? secondsToHours(thirtyDaysSeconds / uniqueDays.size) : 0,
    days_tracked: uniqueDays.size,
  };
}

/**
 * Get workspace name if applicable
 */
async function getWorkspaceName(
  supabase: SupabaseClient,
  workspaceId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from('workspaces')
    .select('name')
    .eq('id', workspaceId)
    .single();

  if (error || !data) {
    return null;
  }

  return data.name;
}

/**
 * Get owner name (first name only for privacy)
 */
async function getOwnerName(supabase: SupabaseClient, userId: string): Promise<string | null> {
  const { data, error } = await supabase.from('users').select('name').eq('id', userId).single();

  if (error || !data || !data.name) {
    return null;
  }

  // Return first name only for privacy
  const firstName = data.name.split(' ')[0];
  return firstName || null;
}

// =============================================================================
// MAIN HANDLER
// =============================================================================

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return handleCorsPreflightRequest();
  }

  // Only allow GET
  if (req.method !== 'GET') {
    return errorResponse('Method not allowed', 405);
  }

  try {
    // Extract token from request
    const token = extractTokenFromRequest(req);

    if (!token) {
      return errorResponse('Missing token parameter', 400);
    }

    // Validate token format
    if (!isValidToken(token)) {
      return errorResponse('Invalid token format', 400);
    }

    // Create Supabase admin client (no auth required for public endpoint)
    // Using service role key to bypass RLS for reading shared dashboards
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch the shared dashboard
    const { data: dashboard, error: dashboardError } = await supabase
      .from('shared_dashboards')
      .select('*')
      .eq('token', token)
      .single();

    if (dashboardError || !dashboard) {
      return errorResponse('Dashboard not found', 404);
    }

    const dashboardData = dashboard as SharedDashboardRow;

    // Check if dashboard is active
    if (!dashboardData.is_active) {
      return errorResponse('Dashboard is no longer active', 404);
    }

    // Check if dashboard has expired
    if (dashboardData.expires_at) {
      const expiresAt = new Date(dashboardData.expires_at);
      if (expiresAt < new Date()) {
        return errorResponse('Dashboard has expired', 410);
      }
    }

    // Fetch analytics data in parallel
    const [dailyTotals, categoryBreakdown, summary, ownerName, workspaceName, topProjects] =
      await Promise.all([
        fetchDailyTotals(
          supabase,
          dashboardData.user_id,
          dashboardData.workspace_id,
          DAILY_TOTALS_DAYS
        ),
        fetchCategoryBreakdown(
          supabase,
          dashboardData.user_id,
          dashboardData.workspace_id,
          DAILY_TOTALS_DAYS
        ),
        fetchSummary(supabase, dashboardData.user_id, dashboardData.workspace_id),
        getOwnerName(supabase, dashboardData.user_id),
        dashboardData.workspace_id
          ? getWorkspaceName(supabase, dashboardData.workspace_id)
          : Promise.resolve(null),
        dashboardData.workspace_id
          ? fetchTopProjects(supabase, dashboardData.workspace_id, DAILY_TOTALS_DAYS)
          : Promise.resolve(undefined),
      ]);

    // Calculate date range
    const now = new Date();
    const startDate = new Date(now);
    startDate.setUTCDate(startDate.getUTCDate() - DAILY_TOTALS_DAYS);

    // Build response
    const response: SharedDashboardData = {
      title: dashboardData.title,
      owner_name: ownerName,
      is_workspace: dashboardData.workspace_id !== null,
      workspace_name: workspaceName,
      date_range: {
        start: startDate.toISOString(),
        end: now.toISOString(),
      },
      summary,
      daily_totals: dailyTotals,
      category_breakdown: categoryBreakdown,
      generated_at: now.toISOString(),
    };

    // Add top projects for workspace dashboards
    if (topProjects) {
      response.top_projects = topProjects;
    }

    return jsonResponse(response);
  } catch (error) {
    console.error('Shared dashboard error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return errorResponse(`Failed to fetch dashboard: ${message}`, 500);
  }
});
