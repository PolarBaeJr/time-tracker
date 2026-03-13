/**
 * AI Context Builder Service
 *
 * Prepares time tracking context for AI chat assistant.
 * Fetches aggregated statistics and formats them for AI consumption.
 *
 * SECURITY:
 * - Never includes raw note content or specific entry descriptions
 * - Only provides aggregated statistics
 * - Sanitizes all category names using sanitizeForAI
 * - No personally identifiable information beyond category names
 */

import { supabase } from '@/lib/supabase';
import { sanitizeForAI } from './summarization';
import type { Category } from '@/schemas';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Category breakdown for context
 */
interface CategoryBreakdown {
  name: string;
  totalSeconds: number;
  percentage: number;
}

/**
 * Goal progress for context
 */
interface GoalContextData {
  type: 'overall' | 'category';
  name?: string;
  targetHours: number;
  actualHours: number;
  progressPercent: number;
}

/**
 * Time tracking context data structure
 */
interface TimeTrackingContext {
  thisWeekSeconds: number;
  thisMonthSeconds: number;
  categoryBreakdown: CategoryBreakdown[];
  goals: GoalContextData[];
  streakDays: number;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Format seconds as hours and minutes string
 * @param seconds - Total seconds
 * @returns Formatted string like "32h 15m"
 */
function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours === 0) {
    return `${minutes}m`;
  }

  if (minutes === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${minutes}m`;
}

/**
 * Get the start of the current week (Monday)
 */
function getWeekStart(): Date {
  const now = new Date();
  const dayOfWeek = now.getDay();
  // Adjust so Monday is 0
  const adjustedDay = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - adjustedDay);
  weekStart.setHours(0, 0, 0, 0);
  return weekStart;
}

/**
 * Get the start of the current month
 */
function getMonthStart(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

/**
 * Get the first day of the current month in YYYY-MM-DD format
 */
function getCurrentMonthString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}-01`;
}

// ============================================================================
// CONTEXT BUILDING
// ============================================================================

/**
 * Build time tracking context for AI assistant
 *
 * Fetches aggregated stats and formats them for AI consumption.
 * Only includes aggregated statistics - never raw entry content.
 *
 * @returns Promise<string> - Formatted context string for AI
 */
export async function buildTimeTrackingContext(): Promise<string> {
  try {
    const contextData = await fetchContextData();
    return formatContextForAI(contextData);
  } catch (error) {
    console.error('[contextBuilder] Failed to build context:', error);
    // Return minimal context on error
    return 'TIME TRACKING SUMMARY:\nUnable to load time tracking data. Please try again later.';
  }
}

/**
 * Fetch all data needed for context building
 */
async function fetchContextData(): Promise<TimeTrackingContext> {
  const weekStart = getWeekStart();
  const monthStart = getMonthStart();
  const currentMonth = getCurrentMonthString();

  // Fetch data in parallel
  const [weekEntriesResult, monthEntriesResult, categoriesResult, goalsResult] = await Promise.all([
    // This week's entries
    supabase
      .from('time_entries')
      .select('duration_seconds, category_id')
      .gte('start_at', weekStart.toISOString())
      .is('deleted_at', null),

    // This month's entries
    supabase
      .from('time_entries')
      .select('duration_seconds, category_id')
      .gte('start_at', monthStart.toISOString())
      .is('deleted_at', null),

    // Categories
    supabase.from('categories').select('id, name'),

    // Goals for current month
    supabase.from('monthly_goals').select('*').eq('month', currentMonth),
  ]);

  // Handle errors gracefully - continue with empty data
  const weekEntries = weekEntriesResult.data ?? [];
  const monthEntries = monthEntriesResult.data ?? [];
  const categories = categoriesResult.data ?? [];
  const goals = goalsResult.data ?? [];

  // Calculate totals
  const thisWeekSeconds = weekEntries.reduce((sum, e) => sum + (e.duration_seconds || 0), 0);
  const thisMonthSeconds = monthEntries.reduce((sum, e) => sum + (e.duration_seconds || 0), 0);

  // Build category map
  const categoryMap = new Map<string, Category>();
  for (const cat of categories) {
    categoryMap.set(cat.id, cat as Category);
  }

  // Calculate weekly breakdown by category
  const categorySeconds = new Map<string, number>();
  for (const entry of weekEntries) {
    if (entry.category_id) {
      const current = categorySeconds.get(entry.category_id) ?? 0;
      categorySeconds.set(entry.category_id, current + (entry.duration_seconds || 0));
    }
  }

  // Build category breakdown with percentages
  const categoryBreakdown: CategoryBreakdown[] = [];
  for (const [categoryId, seconds] of categorySeconds) {
    const category = categoryMap.get(categoryId);
    if (category && seconds > 0) {
      categoryBreakdown.push({
        name: sanitizeForAI(category.name, 50),
        totalSeconds: seconds,
        percentage: thisWeekSeconds > 0 ? (seconds / thisWeekSeconds) * 100 : 0,
      });
    }
  }

  // Sort by total time descending
  categoryBreakdown.sort((a, b) => b.totalSeconds - a.totalSeconds);

  // Build goal progress data
  const goalsContext: GoalContextData[] = [];

  // Calculate monthly totals by category for goal progress
  const monthCategorySeconds = new Map<string | null, number>();
  let monthTotalSeconds = 0;
  for (const entry of monthEntries) {
    monthTotalSeconds += entry.duration_seconds || 0;
    const categoryId = entry.category_id ?? null;
    const current = monthCategorySeconds.get(categoryId) ?? 0;
    monthCategorySeconds.set(categoryId, current + (entry.duration_seconds || 0));
  }

  for (const goal of goals) {
    if (!goal.target_hours) continue;

    if (goal.category_id === null && goal.category_type === null) {
      // Overall goal
      const actualHours = monthTotalSeconds / 3600;
      goalsContext.push({
        type: 'overall',
        targetHours: goal.target_hours,
        actualHours,
        progressPercent: (actualHours / goal.target_hours) * 100,
      });
    } else if (goal.category_id) {
      // Category goal
      const category = categoryMap.get(goal.category_id);
      if (category) {
        const categoryTotal = monthCategorySeconds.get(goal.category_id) ?? 0;
        const actualHours = categoryTotal / 3600;
        goalsContext.push({
          type: 'category',
          name: sanitizeForAI(category.name, 50),
          targetHours: goal.target_hours,
          actualHours,
          progressPercent: (actualHours / goal.target_hours) * 100,
        });
      }
    }
  }

  // Calculate streak (simplified - days with any tracking in past week)
  const streakDays = calculateStreak(weekEntries);

  return {
    thisWeekSeconds,
    thisMonthSeconds,
    categoryBreakdown,
    goals: goalsContext,
    streakDays,
  };
}

/**
 * Calculate tracking streak (days with entries)
 */
function calculateStreak(
  weekEntries: Array<{ duration_seconds: number | null; category_id: string | null }>
): number {
  // Simplified: count days with entries (approximation)
  // A more accurate implementation would track actual dates
  return Math.min(7, weekEntries.filter(e => (e.duration_seconds || 0) > 0).length);
}

/**
 * Format context data as structured text for AI
 */
function formatContextForAI(context: TimeTrackingContext): string {
  const sections: string[] = [];

  // Time tracking summary
  sections.push('TIME TRACKING SUMMARY:');
  sections.push(`This week: ${formatDuration(context.thisWeekSeconds)}`);
  sections.push(`This month: ${formatDuration(context.thisMonthSeconds)}`);

  // Category breakdown
  if (context.categoryBreakdown.length > 0) {
    sections.push('');
    sections.push('CATEGORY BREAKDOWN (This Week):');
    for (const cat of context.categoryBreakdown.slice(0, 10)) {
      sections.push(
        `- ${cat.name}: ${formatDuration(cat.totalSeconds)} (${Math.round(cat.percentage)}%)`
      );
    }
  }

  // Goals
  if (context.goals.length > 0) {
    sections.push('');
    sections.push('GOALS:');
    for (const goal of context.goals) {
      if (goal.type === 'overall') {
        sections.push(
          `- Monthly goal: ${goal.targetHours}h (${Math.round(goal.progressPercent)}% complete, ${goal.actualHours.toFixed(1)}h logged)`
        );
      } else {
        sections.push(
          `- ${goal.name}: ${goal.targetHours}h (${Math.round(goal.progressPercent)}% complete)`
        );
      }
    }
  }

  // Streak info
  if (context.streakDays > 0) {
    sections.push('');
    sections.push(
      `TRACKING STREAK: ${context.streakDays} day${context.streakDays !== 1 ? 's' : ''} this week`
    );
  }

  return sections.join('\n');
}

// ============================================================================
// SYSTEM PROMPT
// ============================================================================

/**
 * Default system prompt for time tracking AI assistant
 */
const DEFAULT_SYSTEM_PROMPT = `You are a helpful productivity assistant for a time tracking application.

Your role is to:
- Help users understand their time tracking patterns
- Answer questions about their productivity and time usage
- Provide encouragement and tips for better time management
- Suggest ways to improve their workflow based on their data

Important guidelines:
- Be concise and friendly
- Focus on actionable advice
- Respect user privacy - only discuss aggregated data provided
- If you don't have enough data to answer, say so
- Never make up statistics or data that wasn't provided

You have access to the following time tracking context:`;

/**
 * Get the system prompt with time tracking context
 *
 * @param context - The formatted time tracking context
 * @returns Complete system prompt for the AI
 */
export function getSystemPrompt(context: string): string {
  return `${DEFAULT_SYSTEM_PROMPT}

${context}

Use this information to help answer the user's questions about their time tracking and productivity.`;
}

// ============================================================================
// EXPORTS
// ============================================================================

export { formatDuration };
