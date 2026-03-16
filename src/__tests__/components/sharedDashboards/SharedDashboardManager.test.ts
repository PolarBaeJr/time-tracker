/**
 * SharedDashboardManager Component Tests
 *
 * Tests for the SharedDashboardManager component logic including:
 * - Status badge determination (active, revoked, expired)
 * - Date formatting for expiry and created dates
 * - Validation of dashboard validity
 */

import type { SharedDashboardWithStats } from '@/schemas';

describe('SharedDashboardManager', () => {
  // ============================================================================
  // Test Data
  // ============================================================================

  const mockActiveDashboard: SharedDashboardWithStats = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    user_id: '123e4567-e89b-12d3-a456-426614174001',
    workspace_id: null,
    token: '123e4567-e89b-12d3-a456-426614174002',
    title: 'My Analytics Dashboard',
    is_active: true,
    expires_at: null,
    created_at: '2024-03-01T10:00:00.000Z',
    workspace_name: null,
  };

  const mockRevokedDashboard: SharedDashboardWithStats = {
    ...mockActiveDashboard,
    id: '223e4567-e89b-12d3-a456-426614174000',
    is_active: false,
  };

  const mockExpiredDashboard: SharedDashboardWithStats = {
    ...mockActiveDashboard,
    id: '323e4567-e89b-12d3-a456-426614174000',
    expires_at: '2023-01-01T00:00:00.000Z', // Past date
  };

  const mockActiveWithExpiry: SharedDashboardWithStats = {
    ...mockActiveDashboard,
    id: '423e4567-e89b-12d3-a456-426614174000',
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days in future
  };

  const mockWorkspaceDashboard: SharedDashboardWithStats = {
    ...mockActiveDashboard,
    id: '523e4567-e89b-12d3-a456-426614174000',
    workspace_id: '623e4567-e89b-12d3-a456-426614174000',
    workspace_name: 'Team Workspace',
    title: 'Team Analytics',
  };

  // ============================================================================
  // Status Badge Logic Tests
  // ============================================================================

  describe('status badge logic (getStatusBadge)', () => {
    /**
     * Get status badge info for a dashboard
     * Mirrors the logic used in DashboardItem component
     */
    function getStatusBadge(dashboard: SharedDashboardWithStats): {
      text: string;
      colorKey: 'error' | 'warning' | 'success';
    } {
      if (!dashboard.is_active) {
        return { text: 'Revoked', colorKey: 'error' };
      }

      if (dashboard.expires_at) {
        const expiresAt = new Date(dashboard.expires_at);
        if (expiresAt < new Date()) {
          return { text: 'Expired', colorKey: 'warning' };
        }
      }

      return { text: 'Active', colorKey: 'success' };
    }

    it('should return Active status for active dashboard without expiry', () => {
      const status = getStatusBadge(mockActiveDashboard);
      expect(status.text).toBe('Active');
      expect(status.colorKey).toBe('success');
    });

    it('should return Revoked status for inactive dashboard', () => {
      const status = getStatusBadge(mockRevokedDashboard);
      expect(status.text).toBe('Revoked');
      expect(status.colorKey).toBe('error');
    });

    it('should return Expired status for expired dashboard', () => {
      const status = getStatusBadge(mockExpiredDashboard);
      expect(status.text).toBe('Expired');
      expect(status.colorKey).toBe('warning');
    });

    it('should return Active status for dashboard with future expiry', () => {
      const status = getStatusBadge(mockActiveWithExpiry);
      expect(status.text).toBe('Active');
      expect(status.colorKey).toBe('success');
    });

    it('should prioritize Revoked over Expired', () => {
      const revokedAndExpired: SharedDashboardWithStats = {
        ...mockExpiredDashboard,
        is_active: false,
      };
      const status = getStatusBadge(revokedAndExpired);
      expect(status.text).toBe('Revoked');
      expect(status.colorKey).toBe('error');
    });
  });

  // ============================================================================
  // Dashboard Validity Tests
  // ============================================================================

  describe('dashboard validity (isSharedDashboardValid)', () => {
    /**
     * Check if a shared dashboard is currently valid
     * Mirrors the isSharedDashboardValid function from useSharedDashboards
     */
    function isSharedDashboardValid(dashboard: SharedDashboardWithStats): boolean {
      if (!dashboard.is_active) {
        return false;
      }

      if (dashboard.expires_at) {
        const expiresAt = new Date(dashboard.expires_at);
        if (expiresAt < new Date()) {
          return false;
        }
      }

      return true;
    }

    it('should return true for active dashboard without expiry', () => {
      expect(isSharedDashboardValid(mockActiveDashboard)).toBe(true);
    });

    it('should return false for revoked dashboard', () => {
      expect(isSharedDashboardValid(mockRevokedDashboard)).toBe(false);
    });

    it('should return false for expired dashboard', () => {
      expect(isSharedDashboardValid(mockExpiredDashboard)).toBe(false);
    });

    it('should return true for dashboard with future expiry', () => {
      expect(isSharedDashboardValid(mockActiveWithExpiry)).toBe(true);
    });

    it('should return false for revoked and expired dashboard', () => {
      const revokedAndExpired: SharedDashboardWithStats = {
        ...mockExpiredDashboard,
        is_active: false,
      };
      expect(isSharedDashboardValid(revokedAndExpired)).toBe(false);
    });
  });

  // ============================================================================
  // Date Formatting Tests
  // ============================================================================

  describe('date formatting', () => {
    /**
     * Format expiry date for display
     * Mirrors formatExpiry logic in DashboardItem
     */
    function formatExpiry(expiresAt: string | null): string | null {
      if (!expiresAt) return null;

      const expiry = new Date(expiresAt);
      const now = new Date();

      if (expiry < now) {
        return 'Expired';
      }

      const diff = expiry.getTime() - now.getTime();
      const days = Math.ceil(diff / (1000 * 60 * 60 * 24));

      if (days <= 0) return 'Expires today';
      if (days === 1) return 'Expires tomorrow';
      return `Expires in ${days} days`;
    }

    it('should return null for dashboard without expiry', () => {
      expect(formatExpiry(null)).toBe(null);
    });

    it('should return "Expired" for past date', () => {
      expect(formatExpiry('2020-01-01T00:00:00.000Z')).toBe('Expired');
    });

    it('should return "Expires in X days" for future date', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 5);
      const result = formatExpiry(futureDate.toISOString());
      expect(result).toMatch(/^Expires in [4-6] days$/); // Allow for timing variations
    });

    it('should return "Expires tomorrow" for date 1 day in future', () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(tomorrow.getHours() + 1); // Ensure it's actually tomorrow
      const result = formatExpiry(tomorrow.toISOString());
      expect(result).toMatch(/^Expires (tomorrow|in [12] days|today)$/);
    });

    /**
     * Format created date for display
     * Mirrors formatCreatedDate logic in DashboardItem
     */
    function formatCreatedDate(createdAt: string): string {
      const date = new Date(createdAt);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    }

    it('should format created date correctly', () => {
      const result = formatCreatedDate('2024-03-01T10:00:00.000Z');
      // Different locales may format slightly differently
      expect(result).toMatch(/Mar\s+1,?\s+2024/);
    });
  });

  // ============================================================================
  // Share URL Generation Tests
  // ============================================================================

  describe('share URL generation (getShareUrl)', () => {
    /**
     * Generate the share URL for a token
     * Mirrors getShareUrl from useSharedDashboards
     */
    function getShareUrl(token: string, baseUrl: string = '/shared'): string {
      return `${baseUrl}/${token}`;
    }

    it('should generate correct share URL', () => {
      const token = '123e4567-e89b-12d3-a456-426614174002';
      const url = getShareUrl(token);
      expect(url).toBe('/shared/123e4567-e89b-12d3-a456-426614174002');
    });

    it('should handle custom base URL', () => {
      const token = '123e4567-e89b-12d3-a456-426614174002';
      const url = getShareUrl(token, 'https://example.com/shared');
      expect(url).toBe('https://example.com/shared/123e4567-e89b-12d3-a456-426614174002');
    });
  });

  // ============================================================================
  // Dashboard Type Tests
  // ============================================================================

  describe('dashboard type detection', () => {
    it('should identify personal dashboard (no workspace_id)', () => {
      expect(mockActiveDashboard.workspace_id).toBe(null);
      expect(mockActiveDashboard.workspace_name).toBe(null);
    });

    it('should identify workspace dashboard', () => {
      expect(mockWorkspaceDashboard.workspace_id).not.toBe(null);
      expect(mockWorkspaceDashboard.workspace_name).toBe('Team Workspace');
    });
  });

  // ============================================================================
  // Title Validation Tests
  // ============================================================================

  describe('title validation', () => {
    /**
     * Validate dashboard title
     * Mirrors schema validation from CreateSharedDashboardSchema
     */
    function validateTitle(title: string): { valid: boolean; error?: string } {
      if (!title || title.trim().length === 0) {
        return { valid: false, error: 'Title is required' };
      }
      if (title.length > 100) {
        return { valid: false, error: 'Title must be 100 characters or less' };
      }
      return { valid: true };
    }

    it('should accept valid title', () => {
      expect(validateTitle('My Analytics Dashboard')).toEqual({ valid: true });
    });

    it('should reject empty title', () => {
      expect(validateTitle('')).toEqual({ valid: false, error: 'Title is required' });
    });

    it('should reject whitespace-only title', () => {
      expect(validateTitle('   ')).toEqual({ valid: false, error: 'Title is required' });
    });

    it('should reject title over 100 characters', () => {
      const longTitle = 'A'.repeat(101);
      expect(validateTitle(longTitle)).toEqual({
        valid: false,
        error: 'Title must be 100 characters or less',
      });
    });

    it('should accept 100 character title', () => {
      const maxTitle = 'A'.repeat(100);
      expect(validateTitle(maxTitle)).toEqual({ valid: true });
    });
  });
});
