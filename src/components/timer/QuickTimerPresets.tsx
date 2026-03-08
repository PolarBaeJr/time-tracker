import * as React from 'react';
import { useState, useCallback } from 'react';
import {
  View,
  ScrollView,
  Pressable,
  StyleSheet,
  Modal,
  TextInput,
  Platform,
  Alert,
  type TextStyle,
} from 'react-native';

import { Text } from '@/components/ui';
import { useTimerSettings, addQuickPreset, removeQuickPreset } from '@/stores/timerSettingsStore';
import { useTheme } from '@/theme';
import type { QuickPreset } from '@/stores/timerSettingsStore';

const MODE_ICONS: Record<QuickPreset['timerMode'], string> = {
  normal: '\u23F1',
  pomodoro: '\u{1F345}',
  countdown: '\u23F3',
};

export interface QuickTimerPresetsProps {
  onSelectPreset: (preset: QuickPreset) => void;
  currentMode: string;
  currentCategoryId: string | null;
  currentDurationSeconds: number | null;
}

export function QuickTimerPresets({
  onSelectPreset,
  currentMode,
  currentCategoryId,
  currentDurationSeconds,
}: QuickTimerPresetsProps): React.ReactElement {
  const { quickPresets } = useTimerSettings();
  const { colors, borderRadius } = useTheme();
  const [showNameModal, setShowNameModal] = useState(false);
  const [presetName, setPresetName] = useState('');

  const handleAddPress = useCallback(() => {
    setPresetName('');
    setShowNameModal(true);
  }, []);

  const handleSavePreset = useCallback(() => {
    const name = presetName.trim();
    if (!name) return;

    const preset: QuickPreset = {
      id: Date.now().toString(36),
      name,
      timerMode: currentMode as QuickPreset['timerMode'],
      categoryId: currentCategoryId,
      durationSeconds: currentDurationSeconds,
    };

    addQuickPreset(preset);
    setShowNameModal(false);
    setPresetName('');
  }, [presetName, currentMode, currentCategoryId, currentDurationSeconds]);

  const handleLongPress = useCallback((preset: QuickPreset) => {
    if (Platform.OS === 'web') {
      if (confirm(`Delete preset "${preset.name}"?`)) {
        removeQuickPreset(preset.id);
      }
    } else {
      Alert.alert('Delete Preset', `Delete "${preset.name}"?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => removeQuickPreset(preset.id) },
      ]);
    }
  }, []);

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {quickPresets.map(preset => (
          <Pressable
            key={preset.id}
            style={({ pressed }) => [
              styles.chip,
              {
                backgroundColor: colors.surfaceVariant,
                borderRadius: borderRadius.full,
              },
              pressed && { backgroundColor: colors.overlayLight },
            ]}
            onPress={() => onSelectPreset(preset)}
            onLongPress={() => handleLongPress(preset)}
            accessibilityRole="button"
            accessibilityLabel={`Start preset ${preset.name}`}
          >
            <Text style={StyleSheet.flatten([styles.modeIcon, { fontSize: 12 }]) as TextStyle}>
              {MODE_ICONS[preset.timerMode]}
            </Text>
            <Text variant="bodySmall" numberOfLines={1}>
              {preset.name}
            </Text>
          </Pressable>
        ))}

        <Pressable
          style={({ pressed }) => [
            styles.chip,
            styles.addChip,
            {
              borderColor: colors.border,
              borderRadius: borderRadius.full,
            },
            pressed && { backgroundColor: colors.overlayLight },
          ]}
          onPress={handleAddPress}
          accessibilityRole="button"
          accessibilityLabel="Save current configuration as preset"
        >
          <Text variant="bodySmall" color="muted">
            + Save
          </Text>
        </Pressable>
      </ScrollView>

      <Modal
        visible={showNameModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowNameModal(false)}
      >
        <Pressable
          style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}
          onPress={() => setShowNameModal(false)}
        >
          <Pressable
            style={[
              styles.modalContent,
              {
                backgroundColor: colors.surface,
                borderRadius: borderRadius.lg,
              },
            ]}
            onPress={() => {}}
          >
            <Text variant="body" style={styles.modalTitle}>
              Save Preset
            </Text>
            <TextInput
              style={[
                styles.nameInput,
                {
                  backgroundColor: colors.surfaceVariant,
                  color: colors.text,
                  borderRadius: borderRadius.md,
                },
              ]}
              placeholder="Preset name"
              placeholderTextColor={colors.textMuted}
              value={presetName}
              onChangeText={setPresetName}
              autoFocus
              maxLength={30}
              onSubmitEditing={handleSavePreset}
            />
            <View style={styles.modalButtons}>
              <Pressable
                style={[styles.modalButton, { borderRadius: borderRadius.md }]}
                onPress={() => setShowNameModal(false)}
              >
                <Text variant="bodySmall" color="muted">
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.modalButton,
                  {
                    backgroundColor: colors.primary,
                    borderRadius: borderRadius.md,
                  },
                ]}
                onPress={handleSavePreset}
              >
                <Text variant="bodySmall">Save</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 16,
    marginBottom: 12,
  },
  scrollContent: {
    paddingHorizontal: 4,
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 4,
  },
  addChip: {
    borderWidth: 1,
    borderStyle: 'dashed',
    backgroundColor: 'transparent',
  },
  modeIcon: {
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: 280,
    padding: 20,
  },
  modalTitle: {
    fontWeight: '600',
    marginBottom: 12,
  },
  nameInput: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  modalButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: 'center',
  },
});

export default QuickTimerPresets;
