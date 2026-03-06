/**
 * Offline Queue Service
 *
 * Manages a persistent queue of actions to be synchronized when the device
 * comes back online. This enables offline-first functionality for time entries.
 *
 * IMPORTANT: Timer operations (start_timer, stop_timer) are NOT queued because
 * the server enforces server-side timestamps via DEFAULT now(). Instead:
 * - When starting a timer offline: track locally but do NOT queue
 * - When stopping a timer offline: calculate duration and queue as 'create_entry'
 * - User should be warned that offline timer sessions become manual entries
 *
 * USAGE:
 * ```typescript
 * import { offlineQueue } from '@/services/offlineQueue';
 *
 * // Add an action to the queue
 * await offlineQueue.addToQueue({
 *   id: crypto.randomUUID(),
 *   action: 'create_entry',
 *   payload: { category_id: '...', start_at: '...', duration_seconds: 3600, notes: 'Work' },
 *   timestamp: new Date().toISOString(),
 *   retryCount: 0,
 * });
 *
 * // Get all queued actions
 * const queue = await offlineQueue.getQueue();
 *
 * // Process the queue when online
 * for (const action of queue) {
 *   const result = await processAction(action);
 *   if (result.success) {
 *     await offlineQueue.removeFromQueue(action.id);
 *   }
 * }
 * ```
 */

import { storage } from '@/lib/storage';
import {
  QueuedActionSchema,
  CreateTimeEntrySchema,
  UpdateTimeEntrySchema,
  type QueuedAction,
  type CreateTimeEntryInput,
  type UpdateTimeEntryInput,
} from '@/schemas';

/**
 * Storage key for the offline queue
 */
const QUEUE_STORAGE_KEY = 'worktracker.offline-queue.v1';

/**
 * Maximum number of retry attempts before giving up on an action
 */
export const MAX_RETRY_ATTEMPTS = 5;

/**
 * Error thrown when offline queue operations fail
 */
export class OfflineQueueError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly action?: QueuedAction
  ) {
    super(message);
    this.name = 'OfflineQueueError';
  }
}

/**
 * Payload types for different queue actions
 */
export type CreateEntryPayload = CreateTimeEntryInput;

export interface UpdateEntryPayload {
  id: string;
  data: UpdateTimeEntryInput;
}

export interface DeleteEntryPayload {
  id: string;
}

/**
 * Union type for all action payloads
 */
export type QueuedActionPayload = CreateEntryPayload | UpdateEntryPayload | DeleteEntryPayload;

/**
 * Result of queue validation
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
  sanitizedPayload?: QueuedActionPayload;
}

/**
 * Validate a queued action's payload based on its action type
 *
 * @param action - The queued action to validate
 * @returns ValidationResult with valid flag and sanitized payload or error
 */
export function validateQueuedAction(action: QueuedAction): ValidationResult {
  try {
    switch (action.action) {
      case 'create_entry': {
        const result = CreateTimeEntrySchema.safeParse(action.payload);
        if (!result.success) {
          return {
            valid: false,
            error: `Invalid create_entry payload: ${result.error.message}`,
          };
        }
        return { valid: true, sanitizedPayload: result.data };
      }

      case 'update_entry': {
        const payload = action.payload as unknown as UpdateEntryPayload;
        if (!payload.id || typeof payload.id !== 'string') {
          return { valid: false, error: 'update_entry requires id field' };
        }
        const result = UpdateTimeEntrySchema.safeParse(payload.data);
        if (!result.success) {
          return {
            valid: false,
            error: `Invalid update_entry payload: ${result.error.message}`,
          };
        }
        return { valid: true, sanitizedPayload: { id: payload.id, data: result.data } };
      }

      case 'delete_entry': {
        const payload = action.payload as unknown as DeleteEntryPayload;
        if (!payload.id || typeof payload.id !== 'string') {
          return { valid: false, error: 'delete_entry requires id field' };
        }
        return { valid: true, sanitizedPayload: { id: payload.id } };
      }

      default:
        return { valid: false, error: `Unknown action type: ${action.action}` };
    }
  } catch (err) {
    return {
      valid: false,
      error: err instanceof Error ? err.message : 'Validation failed',
    };
  }
}

/**
 * Load the queue from storage
 *
 * @returns Promise resolving to array of queued actions
 */
async function loadQueue(): Promise<QueuedAction[]> {
  try {
    const stored = await storage.getItem(QUEUE_STORAGE_KEY);
    if (!stored) {
      return [];
    }

    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) {
      console.warn('[offlineQueue] Invalid queue data, resetting');
      return [];
    }

    // Validate each action
    const validActions: QueuedAction[] = [];
    for (const item of parsed) {
      const result = QueuedActionSchema.safeParse(item);
      if (result.success) {
        validActions.push(result.data);
      } else {
        console.warn('[offlineQueue] Skipping invalid queued action:', item);
      }
    }

    return validActions;
  } catch (err) {
    console.error('[offlineQueue] Failed to load queue:', err);
    return [];
  }
}

/**
 * Save the queue to storage
 *
 * @param queue - Array of queued actions to save
 */
async function saveQueue(queue: QueuedAction[]): Promise<void> {
  try {
    await storage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
  } catch (err) {
    console.error('[offlineQueue] Failed to save queue:', err);
    throw new OfflineQueueError(
      'Failed to persist offline queue',
      'STORAGE_ERROR'
    );
  }
}

/**
 * Offline Queue Manager
 *
 * Provides methods for managing the offline action queue.
 */
export const offlineQueue = {
  /**
   * Get all queued actions
   *
   * @returns Promise resolving to array of queued actions, sorted by timestamp
   */
  async getQueue(): Promise<QueuedAction[]> {
    const queue = await loadQueue();
    // Sort by timestamp (oldest first for FIFO processing)
    return queue.sort((a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  },

  /**
   * Add an action to the queue
   *
   * @param action - The action to queue
   * @throws OfflineQueueError if validation or storage fails
   */
  async addToQueue(action: QueuedAction): Promise<void> {
    // Validate the action schema
    const schemaResult = QueuedActionSchema.safeParse(action);
    if (!schemaResult.success) {
      throw new OfflineQueueError(
        `Invalid action: ${schemaResult.error.message}`,
        'VALIDATION_ERROR',
        action
      );
    }

    // Validate the payload
    const payloadResult = validateQueuedAction(action);
    if (!payloadResult.valid) {
      throw new OfflineQueueError(
        payloadResult.error ?? 'Invalid payload',
        'PAYLOAD_VALIDATION_ERROR',
        action
      );
    }

    const queue = await loadQueue();

    // Check for duplicate IDs
    if (queue.some((a) => a.id === action.id)) {
      console.warn('[offlineQueue] Skipping duplicate action:', action.id);
      return;
    }

    queue.push(action);
    await saveQueue(queue);
  },

  /**
   * Remove an action from the queue by ID
   *
   * @param id - The ID of the action to remove
   * @returns Promise resolving to true if action was found and removed
   */
  async removeFromQueue(id: string): Promise<boolean> {
    const queue = await loadQueue();
    const index = queue.findIndex((a) => a.id === id);

    if (index === -1) {
      return false;
    }

    queue.splice(index, 1);
    await saveQueue(queue);
    return true;
  },

  /**
   * Update the retry count for an action
   *
   * @param id - The ID of the action to update
   * @returns Promise resolving to the updated action or null if not found
   */
  async incrementRetryCount(id: string): Promise<QueuedAction | null> {
    const queue = await loadQueue();
    const action = queue.find((a) => a.id === id);

    if (!action) {
      return null;
    }

    action.retryCount += 1;
    await saveQueue(queue);
    return action;
  },

  /**
   * Clear all queued actions
   */
  async clearQueue(): Promise<void> {
    await saveQueue([]);
  },

  /**
   * Get the count of queued actions
   *
   * @returns Promise resolving to the number of queued actions
   */
  async getQueueLength(): Promise<number> {
    const queue = await loadQueue();
    return queue.length;
  },

  /**
   * Check if the queue has any pending actions
   *
   * @returns Promise resolving to true if there are queued actions
   */
  async hasQueuedActions(): Promise<boolean> {
    const length = await this.getQueueLength();
    return length > 0;
  },

  /**
   * Get actions that have not exceeded the retry limit
   *
   * @returns Promise resolving to array of retryable actions
   */
  async getRetryableActions(): Promise<QueuedAction[]> {
    const queue = await this.getQueue();
    return queue.filter((a) => a.retryCount < MAX_RETRY_ATTEMPTS);
  },

  /**
   * Get actions that have exceeded the retry limit (failed permanently)
   *
   * @returns Promise resolving to array of failed actions
   */
  async getFailedActions(): Promise<QueuedAction[]> {
    const queue = await this.getQueue();
    return queue.filter((a) => a.retryCount >= MAX_RETRY_ATTEMPTS);
  },

  /**
   * Remove all failed actions (exceeded retry limit)
   *
   * @returns Promise resolving to the number of removed actions
   */
  async clearFailedActions(): Promise<number> {
    const queue = await loadQueue();
    const before = queue.length;
    const filtered = queue.filter((a) => a.retryCount < MAX_RETRY_ATTEMPTS);
    await saveQueue(filtered);
    return before - filtered.length;
  },
};

/**
 * Helper function to create a queued action with defaults
 *
 * @param action - Action type
 * @param payload - Action payload
 * @returns A new QueuedAction object
 */
export function createQueuedAction(
  action: QueuedAction['action'],
  payload: QueuedActionPayload
): QueuedAction {
  return {
    id: crypto.randomUUID(),
    action,
    payload: payload as Record<string, unknown>,
    timestamp: new Date().toISOString(),
    retryCount: 0,
  };
}

/**
 * Calculate exponential backoff delay for retries
 *
 * @param retryCount - Current retry attempt (0-indexed)
 * @param baseDelayMs - Base delay in milliseconds (default: 1000)
 * @param maxDelayMs - Maximum delay in milliseconds (default: 30000)
 * @returns Delay in milliseconds
 */
export function calculateBackoffDelay(
  retryCount: number,
  baseDelayMs = 1000,
  maxDelayMs = 30000
): number {
  // Exponential backoff: baseDelay * 2^retryCount with jitter
  const exponentialDelay = baseDelayMs * Math.pow(2, retryCount);
  const jitter = Math.random() * 0.3 * exponentialDelay; // Up to 30% jitter
  return Math.min(exponentialDelay + jitter, maxDelayMs);
}

export default offlineQueue;
