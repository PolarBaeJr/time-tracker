import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';

/**
 * WorkTracker App - Main Entry Point
 *
 * A cross-platform time tracking application built with:
 * - Expo (React Native + React Native Web)
 * - TypeScript
 * - Supabase Backend
 * - Google OAuth Authentication
 */
export default function App() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>WorkTracker</Text>
      <Text style={styles.subtitle}>Time Tracking Made Simple</Text>
      <StatusBar style="light" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F0F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#A1A1AA',
  },
});
