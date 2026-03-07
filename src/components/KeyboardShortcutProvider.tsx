import * as React from 'react';
import { useState, useCallback, useMemo } from 'react';
import { Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';

import { useKeyboardShortcuts, type ShortcutDef } from '@/hooks/useKeyboardShortcuts';
import { KeyboardShortcutHelp } from './KeyboardShortcutHelp';
import type { MainTabParamList } from '@/navigation/types';

type TabNav = BottomTabNavigationProp<MainTabParamList>;

const TAB_NAMES: (keyof MainTabParamList)[] = [
  'Timer',
  'History',
  'Analytics',
  'Categories',
  'Goals',
  'Settings',
];

const ALL_SHORTCUT_DESCRIPTIONS = [
  { key: 'Cmd/Ctrl+1', description: 'Go to Timer' },
  { key: 'Cmd/Ctrl+2', description: 'Go to History' },
  { key: 'Cmd/Ctrl+3', description: 'Go to Analytics' },
  { key: 'Cmd/Ctrl+4', description: 'Go to Categories' },
  { key: 'Cmd/Ctrl+5', description: 'Go to Goals' },
  { key: 'Cmd/Ctrl+6', description: 'Go to Settings' },
  { key: '?', description: 'Show keyboard shortcuts' },
  { key: 'Space', description: 'Start / Stop timer (Timer tab)' },
];

interface KeyboardShortcutProviderProps {
  children: React.ReactNode;
}

export function KeyboardShortcutProvider({
  children,
}: KeyboardShortcutProviderProps): React.ReactElement {
  const [showHelp, setShowHelp] = useState(false);

  if (Platform.OS !== 'web') {
    return <>{children}</>;
  }

  return (
    <KeyboardShortcutProviderInner showHelp={showHelp} setShowHelp={setShowHelp}>
      {children}
    </KeyboardShortcutProviderInner>
  );
}

function KeyboardShortcutProviderInner({
  children,
  showHelp,
  setShowHelp,
}: {
  children: React.ReactNode;
  showHelp: boolean;
  setShowHelp: (v: boolean) => void;
}): React.ReactElement {
  const navigation = useNavigation<TabNav>();

  const toggleHelp = useCallback(() => {
    setShowHelp(!showHelp);
  }, [showHelp, setShowHelp]);

  const closeHelp = useCallback(() => {
    setShowHelp(false);
  }, [setShowHelp]);

  const shortcuts: ShortcutDef[] = useMemo(() => {
    const defs: ShortcutDef[] = [];

    for (let i = 0; i < TAB_NAMES.length; i++) {
      const tabName = TAB_NAMES[i];
      defs.push({
        id: `nav-${tabName}`,
        key: String(i + 1),
        metaKey: true,
        handler: () => navigation.navigate(tabName),
        description: `Go to ${tabName}`,
      });
    }

    defs.push({
      id: 'help',
      key: '?',
      handler: toggleHelp,
      description: 'Show keyboard shortcuts',
    });

    defs.push({
      id: 'help-slash',
      key: '/',
      metaKey: true,
      handler: toggleHelp,
      description: 'Show keyboard shortcuts',
    });

    return defs;
  }, [navigation, toggleHelp]);

  useKeyboardShortcuts(shortcuts);

  return (
    <>
      {children}
      <KeyboardShortcutHelp
        visible={showHelp}
        onClose={closeHelp}
        shortcuts={ALL_SHORTCUT_DESCRIPTIONS}
      />
    </>
  );
}

export default KeyboardShortcutProvider;
