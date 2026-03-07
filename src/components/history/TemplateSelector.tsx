/**
 * TemplateSelector Component
 *
 * Dropdown/modal for selecting entry templates when creating manual entries.
 * Templates are stored locally via AsyncStorage (no DB needed).
 *
 * USAGE:
 * ```tsx
 * <TemplateSelector
 *   onSelect={(template) => applyTemplate(template)}
 * />
 * ```
 */

import * as React from 'react';
import { useState, useCallback } from 'react';
import { View, StyleSheet, Pressable, Modal, ScrollView } from 'react-native';
import { Text, Button, Icon } from '@/components/ui';
import { colors, spacing, fontSizes, borderRadius } from '@/theme';
import { useEntryTemplates, removeTemplate } from '@/stores/entryTemplateStore';
import type { EntryTemplate } from '@/stores/entryTemplateStore';

export interface TemplateSelectorProps {
  onSelect: (template: EntryTemplate) => void;
  disabled?: boolean;
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

export function TemplateSelector({
  onSelect,
  disabled = false,
}: TemplateSelectorProps): React.ReactElement {
  const templates = useEntryTemplates();
  const [modalVisible, setModalVisible] = useState(false);

  const handleSelect = useCallback(
    (template: EntryTemplate) => {
      onSelect(template);
      setModalVisible(false);
    },
    [onSelect]
  );

  const handleDelete = useCallback((id: string) => {
    removeTemplate(id);
  }, []);

  if (templates.length === 0) {
    return <View />;
  }

  return (
    <View style={styles.container}>
      <Pressable
        style={[styles.button, disabled && styles.buttonDisabled]}
        onPress={() => setModalVisible(true)}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel="Load template"
      >
        <Icon name="copy" size={16} color={colors.primary} />
        <Text style={styles.buttonText}>Load Template</Text>
      </Pressable>

      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text variant="heading" style={styles.modalTitle}>
                Entry Templates
              </Text>
              <Pressable
                onPress={() => setModalVisible(false)}
                style={styles.closeButton}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <Icon name="close" size={24} color={colors.text} />
              </Pressable>
            </View>

            <ScrollView style={styles.templateList}>
              {templates.map(template => (
                <View key={template.id} style={styles.templateItem}>
                  <Pressable
                    style={styles.templateContent}
                    onPress={() => handleSelect(template)}
                    accessibilityRole="button"
                  >
                    <Text style={styles.templateName}>{template.name}</Text>
                    <View style={styles.templateMeta}>
                      <Text style={styles.templateDuration}>
                        {formatDuration(template.durationSeconds)}
                      </Text>
                      {template.notes ? (
                        <Text style={styles.templateNotes} numberOfLines={1}>
                          {template.notes}
                        </Text>
                      ) : null}
                    </View>
                  </Pressable>
                  <Pressable
                    style={styles.deleteButton}
                    onPress={() => handleDelete(template.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`Delete template ${template.name}`}
                  >
                    <Icon name="trash" size={16} color={colors.error} />
                  </Pressable>
                </View>
              ))}
            </ScrollView>

            <Button variant="outline" onPress={() => setModalVisible(false)}>
              Cancel
            </Button>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primary + '10',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    fontSize: fontSizes.sm,
    color: colors.primary,
    fontWeight: '500',
    marginLeft: spacing.xs,
  },
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
    padding: spacing.lg,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  modalTitle: {
    fontSize: fontSizes.lg,
  },
  closeButton: {
    padding: spacing.xs,
  },
  templateList: {
    marginBottom: spacing.md,
  },
  templateItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceVariant,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
    overflow: 'hidden',
  },
  templateContent: {
    flex: 1,
    padding: spacing.md,
  },
  templateName: {
    fontSize: fontSizes.md,
    color: colors.text,
    fontWeight: '500',
    marginBottom: 4,
  },
  templateMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  templateDuration: {
    fontSize: fontSizes.sm,
    color: colors.primary,
    fontWeight: '500',
  },
  templateNotes: {
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
    flex: 1,
  },
  deleteButton: {
    padding: spacing.md,
  },
});

export default TemplateSelector;
