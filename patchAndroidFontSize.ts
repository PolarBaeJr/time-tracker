/**
 * MUST be imported before any other app code.
 *
 * Fix React Native 0.83 Fabric crash on Android:
 * "FontSize should be a positive value. Current value: 0"
 *
 * Fabric's TextAttributeProps.getLetterSpacing() crashes when a Text node
 * has letterSpacing but fontSize resolves to 0. This patches StyleSheet.create
 * to inject fontSize: 14 into any style with letterSpacing but no fontSize.
 *
 * Note: The core fix is in patches/react-native+0.83.2.patch which patches
 * Text.js directly. This is a belt-and-suspenders extra layer.
 */
import { StyleSheet, Platform } from 'react-native';

if (Platform.OS === 'android') {
  const originalCreate = StyleSheet.create;
  (StyleSheet as any).create = function patchedCreate<T extends StyleSheet.NamedStyles<T>>(
    styles: T
  ): T {
    for (const key of Object.keys(styles)) {
      const style = (styles as any)[key];
      if (
        style &&
        typeof style === 'object' &&
        'letterSpacing' in style &&
        !('fontSize' in style)
      ) {
        style.fontSize = 14;
      }
    }
    return originalCreate(styles);
  };
}
