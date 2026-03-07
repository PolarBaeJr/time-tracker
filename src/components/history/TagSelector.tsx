/**
 * TagSelector Component
 *
 * Chip-based tag selector for time entries. Displays selected tags as
 * colored chips and allows adding/removing tags with inline creation.
 *
 * USAGE:
 * ```tsx
 * <TagSelector
 *   selectedTagIds={selectedTags}
 *   onTagsChange={setSelectedTags}
 * />
 * ```
 */

import * as React from 'react';
import { useState, useCallback } from 'react';
import { View, StyleSheet, Pressable, Modal, ScrollView, TextInput } from 'react-native';
import { Text, Button, Icon } from '@/components/ui';
import { colors, spacing, fontSizes, borderRadius } from '@/theme';
import { useTags, useCreateTag } from '@/hooks/useTags';
import type { Tag } from '@/schemas';

const DEFAULT_TAG_COLORS = [
  '#6366f1',
  '#ec4899',
  '#f59e0b',
  '#10b981',
  '#3b82f6',
  '#8b5cf6',
  '#ef4444',
  '#14b8a6',
  '#f97316',
  '#06b6d4',
];

export interface TagSelectorProps {
  selectedTagIds: string[];
  onTagsChange: (tagIds: string[]) => void;
  disabled?: boolean;
}

export function TagSelector({
  selectedTagIds,
  onTagsChange,
  disabled = false,
}: TagSelectorProps): React.ReactElement {
  const { data: tags = [] } = useTags();
  const createTag = useCreateTag();
  const [modalVisible, setModalVisible] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(DEFAULT_TAG_COLORS[0]);

  const selectedTags = tags.filter(t => selectedTagIds.includes(t.id));

  const handleToggleTag = useCallback(
    (tagId: string) => {
      if (selectedTagIds.includes(tagId)) {
        onTagsChange(selectedTagIds.filter(id => id !== tagId));
      } else {
        onTagsChange([...selectedTagIds, tagId]);
      }
    },
    [selectedTagIds, onTagsChange]
  );

  const handleRemoveTag = useCallback(
    (tagId: string) => {
      onTagsChange(selectedTagIds.filter(id => id !== tagId));
    },
    [selectedTagIds, onTagsChange]
  );

  const handleCreateTag = async () => {
    const trimmed = newTagName.trim();
    if (!trimmed) return;

    try {
      const tag = await createTag.mutateAsync({ name: trimmed, color: newTagColor });
      onTagsChange([...selectedTagIds, tag.id]);
      setNewTagName('');
      setNewTagColor(DEFAULT_TAG_COLORS[Math.floor(Math.random() * DEFAULT_TAG_COLORS.length)]);
    } catch {
      // Error handled by mutation
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Tags</Text>

      {/* Selected tags as chips */}
      <View style={styles.chipRow}>
        {selectedTags.map(tag => (
          <View
            key={tag.id}
            style={[styles.chip, { backgroundColor: tag.color + '20', borderColor: tag.color }]}
          >
            <View style={[styles.chipDot, { backgroundColor: tag.color }]} />
            <Text style={[styles.chipText, { color: tag.color }]}>{tag.name}</Text>
            {!disabled && (
              <Pressable
                onPress={() => handleRemoveTag(tag.id)}
                style={styles.chipRemove}
                accessibilityRole="button"
                accessibilityLabel={`Remove tag ${tag.name}`}
              >
                <Icon name="close" size={12} color={tag.color} />
              </Pressable>
            )}
          </View>
        ))}

        {!disabled && (
          <Pressable
            style={styles.addButton}
            onPress={() => setModalVisible(true)}
            accessibilityRole="button"
            accessibilityLabel="Add tags"
          >
            <Icon name="plus" size={14} color={colors.primary} />
            <Text style={styles.addText}>Add Tag</Text>
          </Pressable>
        )}
      </View>

      {/* Tag selection modal */}
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
                Select Tags
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

            <ScrollView style={styles.tagList}>
              {tags.map(tag => {
                const isSelected = selectedTagIds.includes(tag.id);
                return (
                  <Pressable
                    key={tag.id}
                    style={[styles.tagOption, isSelected && styles.tagOptionSelected]}
                    onPress={() => handleToggleTag(tag.id)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                  >
                    <View style={[styles.tagColor, { backgroundColor: tag.color }]} />
                    <Text style={styles.tagName}>{tag.name}</Text>
                    {isSelected && <Icon name="check" size={18} color={colors.primary} />}
                  </Pressable>
                );
              })}

              {tags.length === 0 && (
                <Text style={styles.emptyText}>No tags yet. Create one below.</Text>
              )}
            </ScrollView>

            {/* Create new tag inline */}
            <View style={styles.createSection}>
              <Text style={styles.createLabel}>Create New Tag</Text>
              <View style={styles.createRow}>
                <TextInput
                  style={styles.createInput}
                  placeholder="Tag name..."
                  placeholderTextColor={colors.textMuted}
                  value={newTagName}
                  onChangeText={setNewTagName}
                  maxLength={50}
                />
                <Button
                  variant="primary"
                  size="sm"
                  onPress={handleCreateTag}
                  disabled={!newTagName.trim() || createTag.isPending}
                  loading={createTag.isPending}
                >
                  Add
                </Button>
              </View>

              {/* Color picker */}
              <View style={styles.colorRow}>
                {DEFAULT_TAG_COLORS.map(color => (
                  <Pressable
                    key={color}
                    style={[
                      styles.colorOption,
                      { backgroundColor: color },
                      newTagColor === color && styles.colorOptionSelected,
                    ]}
                    onPress={() => setNewTagColor(color)}
                    accessibilityRole="button"
                    accessibilityLabel={`Select color ${color}`}
                  />
                ))}
              </View>
            </View>

            <Button variant="outline" onPress={() => setModalVisible(false)}>
              Done
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
  label: {
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    fontWeight: '500',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  chipDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: spacing.xs,
  },
  chipText: {
    fontSize: fontSizes.xs,
    fontWeight: '500',
  },
  chipRemove: {
    marginLeft: spacing.xs,
    padding: 2,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.primary,
    borderStyle: 'dashed',
  },
  addText: {
    fontSize: fontSizes.xs,
    color: colors.primary,
    marginLeft: 4,
    fontWeight: '500',
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
    maxHeight: '80%',
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
  tagList: {
    marginBottom: spacing.md,
    maxHeight: 250,
  },
  tagOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.xs,
  },
  tagOptionSelected: {
    backgroundColor: colors.primary + '20',
  },
  tagColor: {
    width: 16,
    height: 16,
    borderRadius: borderRadius.sm,
    marginRight: spacing.sm,
  },
  tagName: {
    flex: 1,
    fontSize: fontSizes.md,
    color: colors.text,
  },
  emptyText: {
    fontSize: fontSizes.sm,
    color: colors.textMuted,
    textAlign: 'center',
    padding: spacing.lg,
  },
  createSection: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
    marginBottom: spacing.md,
  },
  createLabel: {
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
    fontWeight: '500',
    marginBottom: spacing.sm,
  },
  createRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  createInput: {
    flex: 1,
    backgroundColor: colors.surfaceVariant,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    fontSize: fontSizes.md,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  colorRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
  colorOption: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorOptionSelected: {
    borderColor: colors.text,
  },
});

export default TagSelector;
