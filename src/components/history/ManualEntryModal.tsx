import * as React from 'react';
import { useCallback } from 'react';
import { View, StyleSheet, Modal, Pressable, Platform, KeyboardAvoidingView } from 'react-native';
import { Text, Icon } from '@/components/ui';
import { QuickEntry } from '@/components/timer';
import { colors, spacing, fontSizes, borderRadius } from '@/theme';

export interface ManualEntryModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function ManualEntryModal({
  visible,
  onClose,
  onSuccess,
}: ManualEntryModalProps): React.ReactElement {
  const handleSuccess = useCallback(() => {
    onClose();
    onSuccess?.();
  }, [onClose, onSuccess]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <Text variant="heading" style={styles.title}>
              Add Entry
            </Text>
            <Pressable
              onPress={onClose}
              style={styles.closeButton}
              accessibilityRole="button"
              accessibilityLabel="Close modal"
            >
              <Icon name="close" size={24} color={colors.text} />
            </Pressable>
          </View>

          {/* Body */}
          <QuickEntry onSuccess={handleSuccess} onCancel={onClose} />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontSize: fontSizes.lg,
  },
  closeButton: {
    padding: spacing.xs,
  },
});

export default ManualEntryModal;
