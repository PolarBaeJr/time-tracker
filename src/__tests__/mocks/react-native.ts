/**
 * Mock React Native module for Jest testing
 *
 * This mock provides minimal implementations of React Native APIs
 * needed for testing business logic without the full RN runtime.
 */

export const Platform = {
  OS: 'web' as const,
  select: <T extends { web?: unknown; native?: unknown }>(obj: T): unknown =>
    obj.web ?? obj.native,
  Version: 0,
  isTV: false,
  isTesting: true,
};

export const StyleSheet = {
  create: <T extends Record<string, Record<string, unknown>>>(styles: T): T => styles,
  flatten: <T>(style: T): T => style,
  absoluteFill: {},
  absoluteFillObject: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    bottom: 0,
    right: 0,
  },
  hairlineWidth: 1,
};

export const Dimensions = {
  get: jest.fn().mockReturnValue({ width: 375, height: 812 }),
  addEventListener: jest.fn().mockReturnValue({ remove: jest.fn() }),
  removeEventListener: jest.fn(),
};

export const Alert = {
  alert: jest.fn(),
};

export const Linking = {
  openURL: jest.fn().mockResolvedValue(true),
  canOpenURL: jest.fn().mockResolvedValue(true),
  getInitialURL: jest.fn().mockResolvedValue(null),
  addEventListener: jest.fn().mockReturnValue({ remove: jest.fn() }),
};

export const AppState = {
  currentState: 'active' as const,
  addEventListener: jest.fn().mockReturnValue({ remove: jest.fn() }),
};

export const Animated = {
  Value: class {
    private value: number;
    constructor(val: number) {
      this.value = val;
    }
    setValue(val: number) {
      this.value = val;
    }
    interpolate() {
      return this;
    }
  },
  View: 'Animated.View',
  Text: 'Animated.Text',
  Image: 'Animated.Image',
  timing: jest.fn().mockReturnValue({ start: jest.fn() }),
  spring: jest.fn().mockReturnValue({ start: jest.fn() }),
  sequence: jest.fn().mockReturnValue({ start: jest.fn() }),
  parallel: jest.fn().mockReturnValue({ start: jest.fn() }),
};

// Basic components
export const View = 'View';
export const Text = 'Text';
export const TouchableOpacity = 'TouchableOpacity';
export const TouchableHighlight = 'TouchableHighlight';
export const TouchableWithoutFeedback = 'TouchableWithoutFeedback';
export const Pressable = 'Pressable';
export const TextInput = 'TextInput';
export const ScrollView = 'ScrollView';
export const FlatList = 'FlatList';
export const Image = 'Image';
export const ActivityIndicator = 'ActivityIndicator';
export const Modal = 'Modal';
export const SafeAreaView = 'SafeAreaView';
export const StatusBar = 'StatusBar';
export const KeyboardAvoidingView = 'KeyboardAvoidingView';
export const RefreshControl = 'RefreshControl';

// Hooks
export const useColorScheme = jest.fn().mockReturnValue('dark');
export const useWindowDimensions = jest.fn().mockReturnValue({ width: 375, height: 812 });

// Types for TypeScript compatibility
export type ViewStyle = Record<string, unknown>;
export type TextStyle = Record<string, unknown>;
export type ImageStyle = Record<string, unknown>;
export type PressableProps = Record<string, unknown>;
export type TextInputProps = Record<string, unknown>;
export type ViewProps = Record<string, unknown>;
export type TextProps = Record<string, unknown>;
export type LayoutChangeEvent = { nativeEvent: { layout: { width: number; height: number } } };

export default {
  Platform,
  StyleSheet,
  Dimensions,
  Alert,
  Linking,
  AppState,
  Animated,
  View,
  Text,
  TouchableOpacity,
  TouchableHighlight,
  TouchableWithoutFeedback,
  Pressable,
  TextInput,
  ScrollView,
  FlatList,
  Image,
  ActivityIndicator,
  Modal,
  SafeAreaView,
  StatusBar,
  KeyboardAvoidingView,
  RefreshControl,
  useColorScheme,
  useWindowDimensions,
};
