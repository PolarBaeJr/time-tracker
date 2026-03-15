/**
 * ApprovalActionSheet Component
 *
 * Bottom sheet that appears after selecting entries for approval/rejection.
 * Provides approve button with optional note and reject button with required note.
 *
 * USAGE:
 * ```tsx
 * <ApprovalActionSheet
 *   visible={showSheet}
 *   entryCount={selectedIds.length}
 *   onApprove={(note) => handleApprove(note)}
 *   onReject={(note) => handleReject(note)}
 *   onClose={() => setShowSheet(false)}
 * />
 * ```
 */

import * as React from 'react';
import { useState, useCallback, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  TextInput,
} from 'react-native';
import { Text, Button, Icon } from '@/components/ui';
import { useTheme } from '@/theme';
import { spacing, borderRadius, fontSizes } from '@/theme';

/**
 * Props for ApprovalActionSheet component
 */
export interface ApprovalActionSheetProps {
  /** Whether the sheet is visible */
  visible: boolean;
  /** Number of entries selected */
  entryCount: number;
  /** Whether an action is in progress */
  isLoading?: boolean;
  /** Callback when approve is confirmed */
  onApprove: (note?: string) => void;
  /** Callback when reject is confirmed */
  onReject: (note: string) => void;
  /** Callback when sheet is closed */
  onClose: () => void;
}

/**
 * Action type for the sheet
 */
type ActionType = 'approve' | 'reject' | null;

/**
 * ApprovalActionSheet component
 */
export function ApprovalActionSheet({
  visible,
  entryCount,
  isLoading = false,
  onApprove,
  onReject,
  onClose,
}: ApprovalActionSheetProps): React.ReactElement {
  const { colors } = useTheme();
  const [activeAction, setActiveAction] = useState<ActionType>(null);
  const [note, setNote] = useState('');
  const [noteError, setNoteError] = useState<string | null>(null);

  /**
   * Reset state when modal closes
   * Using a microtask to avoid synchronous setState within effect
   */
  useEffect(() => {
    if (!visible) {
      const timeout = setTimeout(() => {
        setActiveAction(null);
        setNote('');
        setNoteError(null);
      }, 0);
      return () => clearTimeout(timeout);
    }
  }, [visible]);

  /**
   * Handle action selection
   */
  const handleSelectAction = useCallback((action: ActionType) => {
    setActiveAction(action);
    setNote('');
    setNoteError(null);
  }, []);

  /**
   * Handle back to selection
   */
  const handleBack = useCallback(() => {
    setActiveAction(null);
    setNote('');
    setNoteError(null);
  }, []);

  /**
   * Handle approve confirmation
   */
  const handleConfirmApprove = useCallback(() => {
    onApprove(note.trim() || undefined);
  }, [note, onApprove]);

  /**
   * Handle reject confirmation
   */
  const handleConfirmReject = useCallback(() => {
    const trimmedNote = note.trim();
    if (!trimmedNote) {
      setNoteError('Please provide a reason for rejection');
      return;
    }
    if (trimmedNote.length > 500) {
      setNoteError('Note must be 500 characters or less');
      return;
    }
    setNoteError(null);
    onReject(trimmedNote);
  }, [note, onReject]);

  /**
   * Handle close with check
   */
  const handleClose = useCallback(() => {
    if (!isLoading) {
      onClose();
    }
  }, [isLoading, onClose]);

  /**
   * Render action selection view
   */
  const renderActionSelection = () => (
    <View style={styles.selectionContainer}>
      <Text variant="heading" style={styles.title}>
        {entryCount} {entryCount === 1 ? 'Entry' : 'Entries'} Selected
      </Text>

      <Text variant="body" color="secondary" style={styles.subtitle}>
        Choose an action for the selected entries
      </Text>

      <View style={styles.buttonGroup}>
        <Button
          variant="outline"
          size="lg"
          onPress={() => handleSelectAction('reject')}
          style={StyleSheet.flatten([styles.actionButton, styles.rejectButton])}
          disabled={isLoading}
        >
          Reject with Feedback
        </Button>

        <Button
          variant="primary"
          size="lg"
          onPress={() => handleSelectAction('approve')}
          style={styles.actionButton}
          disabled={isLoading}
        >
          Approve
        </Button>
      </View>
    </View>
  );

  /**
   * Render approve confirmation view
   */
  const renderApproveView = () => (
    <View style={styles.confirmContainer}>
      <Pressable onPress={handleBack} style={styles.backButton} disabled={isLoading}>
        <Icon name="chevron-back" size={20} color={colors.text} />
        <Text variant="body" style={styles.backText}>
          Back
        </Text>
      </Pressable>

      <Text variant="heading" style={styles.title}>
        Approve {entryCount} {entryCount === 1 ? 'Entry' : 'Entries'}
      </Text>

      <Text variant="body" color="secondary" style={styles.subtitle}>
        Add an optional note (visible to submitter)
      </Text>

      <TextInput
        style={[
          styles.noteInput,
          {
            backgroundColor: colors.surfaceVariant,
            color: colors.text,
            borderColor: colors.border,
          },
        ]}
        placeholder="Optional approval note..."
        placeholderTextColor={colors.textMuted}
        value={note}
        onChangeText={setNote}
        multiline
        maxLength={500}
        editable={!isLoading}
        accessibilityLabel="Approval note"
      />

      <Text variant="caption" color="muted" style={styles.charCount}>
        {note.length}/500
      </Text>

      <Button
        variant="primary"
        size="lg"
        onPress={handleConfirmApprove}
        loading={isLoading}
        disabled={isLoading}
        style={styles.confirmButton}
      >
        Confirm Approval
      </Button>
    </View>
  );

  /**
   * Render reject confirmation view
   */
  const renderRejectView = () => (
    <View style={styles.confirmContainer}>
      <Pressable onPress={handleBack} style={styles.backButton} disabled={isLoading}>
        <Icon name="chevron-back" size={20} color={colors.text} />
        <Text variant="body" style={styles.backText}>
          Back
        </Text>
      </Pressable>

      <Text variant="heading" style={styles.title}>
        Reject {entryCount} {entryCount === 1 ? 'Entry' : 'Entries'}
      </Text>

      <Text variant="body" color="secondary" style={styles.subtitle}>
        Provide feedback for the submitter (required)
      </Text>

      <TextInput
        style={[
          styles.noteInput,
          {
            backgroundColor: colors.surfaceVariant,
            color: colors.text,
            borderColor: noteError ? colors.error : colors.border,
          },
        ]}
        placeholder="Reason for rejection..."
        placeholderTextColor={colors.textMuted}
        value={note}
        onChangeText={text => {
          setNote(text);
          if (noteError) setNoteError(null);
        }}
        multiline
        maxLength={500}
        editable={!isLoading}
        accessibilityLabel="Rejection reason"
      />

      {noteError && (
        <Text variant="caption" style={{ color: colors.error, marginTop: spacing.xs }}>
          {noteError}
        </Text>
      )}

      <Text variant="caption" color="muted" style={styles.charCount}>
        {note.length}/500
      </Text>

      <Button
        variant="primary"
        size="lg"
        onPress={handleConfirmReject}
        loading={isLoading}
        disabled={isLoading || !note.trim()}
        style={StyleSheet.flatten([styles.confirmButton, { backgroundColor: colors.error }])}
      >
        Confirm Rejection
      </Button>
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={[styles.overlay, { backgroundColor: colors.overlay }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={styles.backdrop} onPress={handleClose} />

        <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
          {/* Handle */}
          <View style={[styles.handle, { backgroundColor: colors.border }]} />

          {/* Content */}
          {activeAction === null && renderActionSelection()}
          {activeAction === 'approve' && renderApproveView()}
          {activeAction === 'reject' && renderRejectView()}

          {/* Cancel button */}
          <Button
            variant="ghost"
            onPress={handleClose}
            disabled={isLoading}
            style={styles.cancelButton}
          >
            Cancel
          </Button>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    flex: 1,
  },
  sheet: {
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  selectionContainer: {
    alignItems: 'center',
  },
  confirmContainer: {
    // Confirmation view container
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginBottom: spacing.md,
  },
  backText: {
    marginLeft: spacing.xs,
  },
  title: {
    fontSize: fontSizes.xl,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  subtitle: {
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  buttonGroup: {
    width: '100%',
    gap: spacing.sm,
  },
  actionButton: {
    width: '100%',
  },
  rejectButton: {
    // Reject button specific styles
  },
  noteInput: {
    width: '100%',
    minHeight: 100,
    padding: spacing.md,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    fontSize: fontSizes.md,
    textAlignVertical: 'top',
  },
  charCount: {
    alignSelf: 'flex-end',
    marginTop: spacing.xs,
  },
  confirmButton: {
    width: '100%',
    marginTop: spacing.lg,
  },
  cancelButton: {
    width: '100%',
    marginTop: spacing.md,
  },
});

export default ApprovalActionSheet;
