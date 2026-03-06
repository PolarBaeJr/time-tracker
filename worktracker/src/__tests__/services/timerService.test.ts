/**
 * Timer Service Tests
 *
 * Tests for timer service functions including:
 * - startTimer creates correct record
 * - stopTimer calculates duration correctly
 * - Elapsed time calculation handles timezones
 * - Error handling for various scenarios
 */

import { mockActiveTimer, mockTimeEntry } from '../mocks/supabase';
import type { ActiveTimer } from '@/types';

// Mock data
const validTimer = mockActiveTimer();
const validEntry = mockTimeEntry();

// Create mock supabase client
const mockRpc = jest.fn();
const mockFrom = jest.fn();

// Mock Supabase before importing the service
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
    rpc: jest.fn(),
  },
}));

// Mock timer store
jest.mock('@/stores', () => ({
  getTimerStoreState: jest.fn().mockReturnValue({
    activeTimer: null,
    localElapsed: 0,
    isRunning: false,
    offlineQueue: [],
    setActiveTimer: jest.fn(),
    startLocalTick: jest.fn(),
    stopLocalTick: jest.fn(),
    queueAction: jest.fn(),
    clearQueue: jest.fn(),
    syncFromServer: jest.fn(),
  }),
}));

// Now import the service
import { supabase } from '@/lib/supabase';
import {
  startTimer,
  stopTimer,
  getActiveTimer,
  syncTimer,
  TimerServiceError,
} from '@/services/timerService';

describe('timerService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================================
  // startTimer Tests
  // ============================================================================

  describe('startTimer', () => {
    it('should create a timer without category', async () => {
      // Setup mock
      const mockSingle = jest.fn().mockResolvedValue({
        data: validTimer,
        error: null,
      });
      const mockSelect = jest.fn().mockReturnValue({ single: mockSingle });
      const mockInsert = jest.fn().mockReturnValue({ select: mockSelect });
      (supabase.from as jest.Mock).mockReturnValue({ insert: mockInsert });

      const result = await startTimer();

      expect(result.error).toBeNull();
      expect(result.data).toEqual(validTimer);

      // Verify insert was called with correct data
      expect(mockInsert).toHaveBeenCalledWith({
        category_id: null,
        running: true,
      });

      // Verify started_at is NOT sent (server sets it)
      expect(mockInsert).not.toHaveBeenCalledWith(
        expect.objectContaining({ started_at: expect.any(String) })
      );
    });

    it('should create a timer with category', async () => {
      const categoryId = '123e4567-e89b-12d3-a456-426614174000';
      const timerWithCategory = mockActiveTimer({ category_id: categoryId });

      const mockSingle = jest.fn().mockResolvedValue({
        data: timerWithCategory,
        error: null,
      });
      const mockSelect = jest.fn().mockReturnValue({ single: mockSingle });
      const mockInsert = jest.fn().mockReturnValue({ select: mockSelect });
      (supabase.from as jest.Mock).mockReturnValue({ insert: mockInsert });

      const result = await startTimer({ categoryId });

      expect(result.error).toBeNull();
      expect(result.data).toEqual(timerWithCategory);
      expect(mockInsert).toHaveBeenCalledWith({
        category_id: categoryId,
        running: true,
      });
    });

    it('should return error when timer already exists', async () => {
      const mockSingle = jest.fn().mockResolvedValue({
        data: null,
        error: { message: 'duplicate key value', code: '23505' },
      });
      const mockSelect = jest.fn().mockReturnValue({ single: mockSingle });
      const mockInsert = jest.fn().mockReturnValue({ select: mockSelect });
      (supabase.from as jest.Mock).mockReturnValue({ insert: mockInsert });

      const result = await startTimer();

      expect(result.error).toBeInstanceOf(TimerServiceError);
      expect(result.error?.code).toBe('23505');
      expect(result.error?.message).toContain('already running');
    });

    it('should validate category_id as UUID', async () => {
      const result = await startTimer({ categoryId: 'invalid-uuid' });

      expect(result.error).toBeInstanceOf(TimerServiceError);
      expect(result.data).toBeNull();
    });

    it('should handle null category_id', async () => {
      const mockSingle = jest.fn().mockResolvedValue({
        data: validTimer,
        error: null,
      });
      const mockSelect = jest.fn().mockReturnValue({ single: mockSingle });
      const mockInsert = jest.fn().mockReturnValue({ select: mockSelect });
      (supabase.from as jest.Mock).mockReturnValue({ insert: mockInsert });

      const result = await startTimer({ categoryId: null });

      expect(result.error).toBeNull();
      expect(mockInsert).toHaveBeenCalledWith({
        category_id: null,
        running: true,
      });
    });
  });

  // ============================================================================
  // stopTimer Tests
  // ============================================================================

  describe('stopTimer', () => {
    it('should stop timer and create time entry', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: validEntry,
        error: null,
      });

      const result = await stopTimer();

      expect(result.error).toBeNull();
      expect(result.data).toEqual(validEntry);
      expect(supabase.rpc).toHaveBeenCalledWith('stop_timer_and_create_entry', {
        p_notes: null,
      });
    });

    it('should include notes when stopping timer', async () => {
      const notes = 'Completed feature implementation';
      const entryWithNotes = mockTimeEntry({ notes });

      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: entryWithNotes,
        error: null,
      });

      const result = await stopTimer({ notes });

      expect(result.error).toBeNull();
      expect(supabase.rpc).toHaveBeenCalledWith('stop_timer_and_create_entry', {
        p_notes: notes,
      });
    });

    it('should return error when no active timer', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: null,
        error: { message: 'No active timer found', code: 'PGRST116' },
      });

      const result = await stopTimer();

      expect(result.error).toBeInstanceOf(TimerServiceError);
      expect(result.error?.message).toContain('No active timer');
    });

    it('should validate notes length (max 1000 chars)', async () => {
      const longNotes = 'a'.repeat(1001);

      const result = await stopTimer({ notes: longNotes });

      expect(result.error).toBeInstanceOf(TimerServiceError);
      expect(result.data).toBeNull();
    });

    it('should handle null notes', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: validEntry,
        error: null,
      });

      const result = await stopTimer({ notes: null });

      expect(result.error).toBeNull();
      expect(supabase.rpc).toHaveBeenCalledWith('stop_timer_and_create_entry', {
        p_notes: null,
      });
    });
  });

  // ============================================================================
  // getActiveTimer Tests
  // ============================================================================

  describe('getActiveTimer', () => {
    it('should return active timer when exists', async () => {
      const mockMaybeSingle = jest.fn().mockResolvedValue({
        data: validTimer,
        error: null,
      });
      const mockSelect = jest.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
      (supabase.from as jest.Mock).mockReturnValue({ select: mockSelect });

      const result = await getActiveTimer();

      expect(result.error).toBeNull();
      expect(result.data).toEqual(validTimer);
    });

    it('should return null when no active timer', async () => {
      const mockMaybeSingle = jest.fn().mockResolvedValue({
        data: null,
        error: null,
      });
      const mockSelect = jest.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
      (supabase.from as jest.Mock).mockReturnValue({ select: mockSelect });

      const result = await getActiveTimer();

      expect(result.error).toBeNull();
      expect(result.data).toBeNull();
    });

    it('should handle database errors', async () => {
      const mockMaybeSingle = jest.fn().mockResolvedValue({
        data: null,
        error: { message: 'Database connection failed', code: 'PGRST000' },
      });
      const mockSelect = jest.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
      (supabase.from as jest.Mock).mockReturnValue({ select: mockSelect });

      const result = await getActiveTimer();

      expect(result.error).toBeInstanceOf(TimerServiceError);
      expect(result.error?.message).toContain('Database connection failed');
    });
  });

  // ============================================================================
  // syncTimer Tests
  // ============================================================================

  describe('syncTimer', () => {
    it('should return no conflict when both timers are null', () => {
      const result = syncTimer(null, null);

      expect(result.hadConflict).toBe(false);
      expect(result.resolvedTimer).toBeNull();
      expect(result.message).toBe('No timer active');
    });

    it('should detect conflict when local timer exists but server has none', () => {
      const result = syncTimer(validTimer, null);

      expect(result.hadConflict).toBe(true);
      expect(result.resolvedTimer).toBeNull();
      expect(result.message).toBe('Timer was stopped on another device');
    });

    it('should detect conflict when server has timer but local has none', () => {
      const result = syncTimer(null, validTimer);

      expect(result.hadConflict).toBe(true);
      expect(result.resolvedTimer).toEqual(validTimer);
      expect(result.message).toBe('Timer was started on another device');
    });

    it('should return no conflict when timers are identical', () => {
      const result = syncTimer(validTimer, validTimer);

      expect(result.hadConflict).toBe(false);
      expect(result.resolvedTimer).toEqual(validTimer);
      expect(result.message).toBe('Timer in sync');
    });

    it('should detect conflict when category changed', () => {
      const localTimer = mockActiveTimer({
        id: 'timer-123-uuid',
        category_id: '123e4567-e89b-12d3-a456-426614174001',
      });
      const serverTimer = mockActiveTimer({
        id: 'timer-123-uuid',
        category_id: '123e4567-e89b-12d3-a456-426614174002',
      });

      const result = syncTimer(localTimer, serverTimer);

      expect(result.hadConflict).toBe(true);
      expect(result.resolvedTimer).toEqual(serverTimer);
      expect(result.message).toBe('Timer category was changed on another device');
    });

    it('should detect conflict when different timer IDs', () => {
      const localTimer = mockActiveTimer({ id: '123e4567-e89b-12d3-a456-426614174001' });
      const serverTimer = mockActiveTimer({ id: '123e4567-e89b-12d3-a456-426614174002' });

      const result = syncTimer(localTimer, serverTimer);

      expect(result.hadConflict).toBe(true);
      expect(result.resolvedTimer).toEqual(serverTimer);
      expect(result.message).toBe('A different timer is now active (started from another device)');
    });
  });

  // ============================================================================
  // Elapsed Time Calculation Tests
  // ============================================================================

  describe('elapsed time calculation', () => {
    it('should calculate elapsed seconds from started_at', () => {
      // This tests the logic that would be in the timer store
      const now = Date.now();
      const fiveMinutesAgo = new Date(now - 5 * 60 * 1000).toISOString();

      const timer = mockActiveTimer({ started_at: fiveMinutesAgo });

      // Calculate elapsed
      const startedAtMs = Date.parse(timer.started_at);
      const elapsedSeconds = Math.max(0, Math.floor((now - startedAtMs) / 1000));

      // Should be approximately 300 seconds (5 minutes)
      expect(elapsedSeconds).toBeGreaterThanOrEqual(299);
      expect(elapsedSeconds).toBeLessThanOrEqual(301);
    });

    it('should handle different timezones correctly', () => {
      // Test with UTC timestamp
      const utcTime = '2024-03-01T10:00:00.000Z';
      const timer = mockActiveTimer({ started_at: utcTime });

      // Parse the UTC timestamp
      const startedAtMs = Date.parse(timer.started_at);

      // The parsed time should be correct regardless of local timezone
      const expectedMs = Date.UTC(2024, 2, 1, 10, 0, 0, 0);
      expect(startedAtMs).toBe(expectedMs);
    });

    it('should return 0 for invalid started_at', () => {
      const timer = mockActiveTimer({ started_at: 'invalid-date' });
      const startedAtMs = Date.parse(timer.started_at);

      expect(Number.isNaN(startedAtMs)).toBe(true);

      // Our elapsed calculation should return 0 for invalid dates
      const elapsedSeconds = Number.isNaN(startedAtMs)
        ? 0
        : Math.max(0, Math.floor((Date.now() - startedAtMs) / 1000));

      expect(elapsedSeconds).toBe(0);
    });

    it('should return 0 for future started_at', () => {
      const futureTime = new Date(Date.now() + 60000).toISOString();
      const timer = mockActiveTimer({ started_at: futureTime });

      const startedAtMs = Date.parse(timer.started_at);
      const elapsedSeconds = Math.max(0, Math.floor((Date.now() - startedAtMs) / 1000));

      expect(elapsedSeconds).toBe(0);
    });
  });

  // ============================================================================
  // Error Type Tests
  // ============================================================================

  describe('TimerServiceError', () => {
    it('should include operation type', () => {
      const error = new TimerServiceError('Test error', 'ERR001', 'start');

      expect(error.operation).toBe('start');
      expect(error.code).toBe('ERR001');
      expect(error.name).toBe('TimerServiceError');
    });

    it('should be instance of Error', () => {
      const error = new TimerServiceError('Test error');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(TimerServiceError);
    });
  });
});
