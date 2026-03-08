import { registerRootComponent } from 'expo';
import { Text, TextInput, Platform } from 'react-native';

import App from './App';

// Fix React Native 0.83 Fabric crash on Android:
// "FontSize should be a positive value. Current value: 0"
// letterSpacing calculation crashes when fontSize is 0 (unset).
// Set a global default fontSize for all Text and TextInput components.
if (Platform.OS !== 'web') {
  const defaultTextProps = (Text as any).defaultProps || {};
  defaultTextProps.style = { fontSize: 14, ...(defaultTextProps.style || {}) };
  (Text as any).defaultProps = defaultTextProps;

  const defaultTextInputProps = (TextInput as any).defaultProps || {};
  defaultTextInputProps.style = { fontSize: 14, ...(defaultTextInputProps.style || {}) };
  (TextInput as any).defaultProps = defaultTextInputProps;
}

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
