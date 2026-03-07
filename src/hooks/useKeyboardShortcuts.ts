import { useEffect } from 'react';
import { Platform } from 'react-native';

export interface ShortcutDef {
  id: string;
  key: string;
  metaKey?: boolean;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  handler: () => void;
  description: string;
}

function isInputElement(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || target.isContentEditable;
}

export function useKeyboardShortcuts(shortcuts: ShortcutDef[], enabled: boolean = true): void {
  useEffect(() => {
    if (Platform.OS !== 'web' || !enabled) return;

    function handleKeyDown(event: KeyboardEvent): void {
      if (isInputElement(event.target)) return;

      for (const shortcut of shortcuts) {
        const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();
        if (!keyMatch) continue;

        const metaMatch = shortcut.metaKey ? event.metaKey || event.ctrlKey : true;
        const ctrlMatch = shortcut.ctrlKey ? event.ctrlKey || event.metaKey : true;
        const shiftMatch = shortcut.shiftKey ? event.shiftKey : !event.shiftKey;
        const altMatch = shortcut.altKey ? event.altKey : !event.altKey;

        const requiresMod = shortcut.metaKey || shortcut.ctrlKey;
        if (!requiresMod && (event.metaKey || event.ctrlKey)) continue;

        if (metaMatch && ctrlMatch && shiftMatch && altMatch) {
          event.preventDefault();
          shortcut.handler();
          return;
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts, enabled]);
}
