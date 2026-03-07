import * as React from 'react';
import { View, Modal, TouchableOpacity, StyleSheet, ScrollView, Platform } from 'react-native';

import { Button, Card, Text } from '@/components/ui';
import { useTheme } from '@/theme';
import { spacing, borderRadius } from '@/theme';

interface ShortcutInfo {
  key: string;
  description: string;
}

interface KeyboardShortcutHelpProps {
  visible: boolean;
  onClose: () => void;
  shortcuts: ShortcutInfo[];
}

function formatKey(key: string): string {
  const isMac = Platform.OS === 'web' && navigator.platform.includes('Mac');
  const mod = isMac ? '\u2318' : 'Ctrl';

  return key.replace('Cmd/Ctrl+', `${mod}+`).replace('Cmd/Ctrl +', `${mod} +`);
}

export function KeyboardShortcutHelp({
  visible,
  onClose,
  shortcuts,
}: KeyboardShortcutHelpProps): React.ReactElement {
  const { colors } = useTheme();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <TouchableOpacity
        style={[styles.overlay, { backgroundColor: colors.overlay }]}
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableOpacity activeOpacity={1} onPress={e => e.stopPropagation()}>
          <Card style={styles.modal} backgroundColor={colors.surface} padding="none" elevation="lg">
            <View style={[styles.header, { borderBottomColor: colors.border }]}>
              <Text variant="heading">Keyboard Shortcuts</Text>
              <Button variant="ghost" size="sm" onPress={onClose} accessibilityLabel="Close">
                {'\u2715'}
              </Button>
            </View>

            <ScrollView
              style={styles.list}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
            >
              {shortcuts.map((shortcut, index) => (
                <View key={index} style={[styles.row, { borderBottomColor: colors.border }]}>
                  <Text variant="body" style={styles.description}>
                    {shortcut.description}
                  </Text>
                  <View style={[styles.keyBadge, { backgroundColor: colors.surfaceVariant }]}>
                    <Text variant="bodySmall" style={styles.keyText}>
                      {formatKey(shortcut.key)}
                    </Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          </Card>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  modal: {
    width: '100%',
    maxWidth: 420,
    maxHeight: 500,
    borderRadius: borderRadius.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },
  list: {
    flexGrow: 0,
  },
  listContent: {
    paddingVertical: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  description: {
    flex: 1,
  },
  keyBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    marginLeft: spacing.md,
  },
  keyText: {
    fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
    fontWeight: '600',
  },
});

export default KeyboardShortcutHelp;
