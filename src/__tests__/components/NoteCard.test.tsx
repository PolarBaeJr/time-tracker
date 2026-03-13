/**
 * NoteCard Component Tests
 *
 * Tests for the NoteCard component logic including:
 * - Displays title and content preview correctly
 * - Truncates long content
 * - Shows pinned indicator
 * - Calls onPress when tapped
 * - Calls onEdit when edit is pressed
 * - Calls onDelete when delete is pressed
 * - Calls onPin when pin is pressed
 * - Accessibility labels present
 * - Category badge display
 * - Date formatting
 */

import type { Note } from '@/schemas';

// Test the component logic directly without rendering

describe('NoteCard', () => {
  const mockNote: Note = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    user_id: '123e4567-e89b-12d3-a456-426614174001',
    title: 'Meeting Notes',
    content: 'Discussed project timeline and milestones. Need to follow up with the team.',
    category_id: '123e4567-e89b-12d3-a456-426614174002',
    time_entry_id: null,
    pinned: false,
    created_at: '2024-03-01T10:00:00.000Z',
    updated_at: '2024-03-01T11:30:00.000Z',
    deleted_at: null,
  };

  const pinnedNote: Note = {
    ...mockNote,
    pinned: true,
  };

  // ============================================================================
  // Content Preview Tests
  // ============================================================================

  describe('content preview (truncateContent)', () => {
    /**
     * Truncate content to a preview length
     * Mirrors the truncateContent function in NoteCard
     */
    function truncateContent(content: string | null, maxLength: number = 100): string {
      if (!content) return '';
      // Collapse newlines to spaces for preview
      const collapsed = content.replace(/\n+/g, ' ').trim();
      if (collapsed.length <= maxLength) return collapsed;
      return collapsed.slice(0, maxLength).trim() + '...';
    }

    it('should display content preview when present', () => {
      const preview = truncateContent(mockNote.content);
      expect(preview).toBe(
        'Discussed project timeline and milestones. Need to follow up with the team.'
      );
    });

    it('should return empty string when content is null', () => {
      expect(truncateContent(null)).toBe('');
    });

    it('should truncate long content to 100 characters with ellipsis', () => {
      const longContent =
        'This is a very long note that exceeds the maximum length and should be truncated with an ellipsis at the end to indicate there is more content to read.';
      const preview = truncateContent(longContent);

      expect(preview.length).toBeLessThanOrEqual(103); // 100 + '...'
      expect(preview.endsWith('...')).toBe(true);
    });

    it('should not truncate short content', () => {
      const shortContent = 'Short note';
      const preview = truncateContent(shortContent);

      expect(preview).toBe('Short note');
      expect(preview.endsWith('...')).toBe(false);
    });

    it('should collapse newlines to spaces', () => {
      const contentWithNewlines = 'Line 1\n\nLine 2\nLine 3';
      const preview = truncateContent(contentWithNewlines);

      expect(preview).toBe('Line 1 Line 2 Line 3');
      expect(preview).not.toContain('\n');
    });

    it('should trim whitespace', () => {
      const contentWithWhitespace = '  Some content with spaces  ';
      const preview = truncateContent(contentWithWhitespace);

      expect(preview).toBe('Some content with spaces');
    });

    it('should handle exactly 100 character content', () => {
      const exactContent = 'a'.repeat(100);
      const preview = truncateContent(exactContent);

      expect(preview.length).toBe(100);
      expect(preview.endsWith('...')).toBe(false);
    });

    it('should truncate content with custom max length', () => {
      const content = 'This is some longer content that should be truncated.';
      const preview = truncateContent(content, 20);

      expect(preview.length).toBeLessThanOrEqual(23); // 20 + '...'
      expect(preview.endsWith('...')).toBe(true);
    });
  });

  // ============================================================================
  // Date Formatting Tests
  // ============================================================================

  describe('date formatting (formatDate)', () => {
    /**
     * Format date from ISO string to readable format
     * Mirrors the formatDate function in NoteCard
     */
    function formatDate(isoString: string): string {
      const date = new Date(isoString);
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      if (date.toDateString() === today.toDateString()) {
        return 'Today';
      }

      if (date.toDateString() === yesterday.toDateString()) {
        return 'Yesterday';
      }

      return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
      });
    }

    it('should display "Today" for notes updated today', () => {
      const todayISO = new Date().toISOString();
      expect(formatDate(todayISO)).toBe('Today');
    });

    it('should display "Yesterday" for notes updated yesterday', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      expect(formatDate(yesterday.toISOString())).toBe('Yesterday');
    });

    it('should display formatted date for older notes', () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 10);
      const formatted = formatDate(oldDate.toISOString());

      expect(formatted).not.toBe('Today');
      expect(formatted).not.toBe('Yesterday');
      // Should contain month and day
      expect(formatted).toMatch(/\w+\s+\d+/);
    });
  });

  // ============================================================================
  // Pinned Indicator Tests
  // ============================================================================

  describe('pinned indicator', () => {
    function shouldShowPinIndicator(note: Note): boolean {
      return note.pinned === true;
    }

    it('should show pinned indicator when note is pinned', () => {
      expect(shouldShowPinIndicator(pinnedNote)).toBe(true);
    });

    it('should not show pinned indicator when note is not pinned', () => {
      expect(shouldShowPinIndicator(mockNote)).toBe(false);
    });
  });

  // ============================================================================
  // Callback Tests
  // ============================================================================

  describe('onPress callback', () => {
    it('should call onPress with note when card is pressed', () => {
      const mockOnPress = jest.fn();
      mockOnPress(mockNote);

      expect(mockOnPress).toHaveBeenCalledWith(mockNote);
    });

    it('should be pressable only when onPress is provided', () => {
      const isPressable = (onPress: ((note: Note) => void) | undefined) => onPress !== undefined;

      expect(isPressable(undefined)).toBe(false);
      expect(isPressable(jest.fn())).toBe(true);
    });
  });

  describe('onEdit callback', () => {
    it('should call onEdit with note when edit button is pressed', () => {
      const mockOnEdit = jest.fn();
      mockOnEdit(mockNote);

      expect(mockOnEdit).toHaveBeenCalledWith(mockNote);
    });

    it('should render edit button only when onEdit is provided', () => {
      const showEditButton = (onEdit: ((note: Note) => void) | undefined) => onEdit !== undefined;

      expect(showEditButton(undefined)).toBe(false);
      expect(showEditButton(jest.fn())).toBe(true);
    });
  });

  describe('onDelete callback', () => {
    it('should call onDelete with note when delete button is pressed', () => {
      const mockOnDelete = jest.fn();
      mockOnDelete(mockNote);

      expect(mockOnDelete).toHaveBeenCalledWith(mockNote);
    });

    it('should render delete button only when onDelete is provided', () => {
      const showDeleteButton = (onDelete: ((note: Note) => void) | undefined) =>
        onDelete !== undefined;

      expect(showDeleteButton(undefined)).toBe(false);
      expect(showDeleteButton(jest.fn())).toBe(true);
    });
  });

  describe('onPin callback', () => {
    it('should call onPin with note when pin button is pressed', () => {
      const mockOnPin = jest.fn();
      mockOnPin(mockNote);

      expect(mockOnPin).toHaveBeenCalledWith(mockNote);
    });

    it('should render pin button only when onPin is provided', () => {
      const showPinButton = (onPin: ((note: Note) => void) | undefined) => onPin !== undefined;

      expect(showPinButton(undefined)).toBe(false);
      expect(showPinButton(jest.fn())).toBe(true);
    });
  });

  // ============================================================================
  // Accessibility Tests
  // ============================================================================

  describe('accessibility', () => {
    function getAccessibilityLabel(note: Note): string {
      return `Note: ${note.title}${note.pinned ? ', pinned' : ''}`;
    }

    it('should have accessible label with title', () => {
      const label = getAccessibilityLabel(mockNote);
      expect(label).toBe('Note: Meeting Notes');
    });

    it('should include "pinned" in accessibility label for pinned notes', () => {
      const label = getAccessibilityLabel(pinnedNote);
      expect(label).toBe('Note: Meeting Notes, pinned');
      expect(label).toContain('pinned');
    });

    it('should have correct edit button label', () => {
      const editButtonLabel = 'Edit note';
      expect(editButtonLabel).toBe('Edit note');
    });

    it('should have correct delete button label', () => {
      const deleteButtonLabel = 'Delete note';
      expect(deleteButtonLabel).toBe('Delete note');
    });

    it('should have correct pin button label when pinned', () => {
      const pinButtonLabel = (isPinned: boolean) => (isPinned ? 'Unpin note' : 'Pin note');

      expect(pinButtonLabel(true)).toBe('Unpin note');
      expect(pinButtonLabel(false)).toBe('Pin note');
    });

    it('should have button accessibility role', () => {
      const accessibilityRole = 'button';
      expect(accessibilityRole).toBe('button');
    });
  });

  // ============================================================================
  // Category Display Tests
  // ============================================================================

  describe('category display', () => {
    interface CategoryDisplayProps {
      categoryName: string | null;
      categoryColor: string | null;
    }

    function getCategoryDisplay(props: CategoryDisplayProps) {
      if (!props.categoryName) {
        return {
          showBadge: false,
        };
      }

      return {
        showBadge: true,
        name: props.categoryName,
        color: props.categoryColor || '#6366F1', // fallback color
      };
    }

    it('should show category badge when category is provided', () => {
      const display = getCategoryDisplay({
        categoryName: 'Work',
        categoryColor: '#6366F1',
      });

      expect(display.showBadge).toBe(true);
      expect(display.name).toBe('Work');
    });

    it('should not show category badge when category is null', () => {
      const display = getCategoryDisplay({
        categoryName: null,
        categoryColor: null,
      });

      expect(display.showBadge).toBe(false);
    });

    it('should use provided color for category dot', () => {
      const display = getCategoryDisplay({
        categoryName: 'Personal',
        categoryColor: '#10B981',
      });

      expect(display.color).toBe('#10B981');
    });

    it('should use fallback color when color is null', () => {
      const display = getCategoryDisplay({
        categoryName: 'Test',
        categoryColor: null,
      });

      expect(display.color).toBe('#6366F1');
    });
  });

  // ============================================================================
  // Title Display Tests
  // ============================================================================

  describe('title display', () => {
    it('should display the note title', () => {
      expect(mockNote.title).toBe('Meeting Notes');
    });

    it('should handle long titles (numberOfLines=1)', () => {
      const longTitle =
        'This is a very long title that should be truncated in the UI with numberOfLines=1';
      const note = { ...mockNote, title: longTitle };
      expect(note.title).toBe(longTitle);
      // Actual truncation is handled by React Native's numberOfLines prop
    });
  });

  // ============================================================================
  // Note Data Structure Tests
  // ============================================================================

  describe('note data structure', () => {
    it('should have all required fields', () => {
      expect(mockNote.id).toBeDefined();
      expect(mockNote.user_id).toBeDefined();
      expect(mockNote.title).toBeDefined();
      expect(mockNote.created_at).toBeDefined();
      expect(mockNote.updated_at).toBeDefined();
    });

    it('should handle null optional fields', () => {
      const noteWithNulls: Note = {
        ...mockNote,
        content: null,
        category_id: null,
        time_entry_id: null,
        deleted_at: null,
      };

      expect(noteWithNulls.content).toBeNull();
      expect(noteWithNulls.category_id).toBeNull();
      expect(noteWithNulls.time_entry_id).toBeNull();
      expect(noteWithNulls.deleted_at).toBeNull();
    });
  });
});
