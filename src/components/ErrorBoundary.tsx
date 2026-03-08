import * as React from 'react';
import { View, StyleSheet, ScrollView, Pressable } from 'react-native';
import { Text } from '@/components/ui';
import { colors, spacing } from '@/theme';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text variant="heading" style={styles.title}>
            Something went wrong
          </Text>
          <ScrollView style={styles.scroll}>
            <Text variant="body" color="muted" style={styles.message}>
              {this.state.error?.message ?? 'Unknown error'}
            </Text>
            <Text variant="caption" color="muted" style={styles.stack}>
              {this.state.error?.stack?.slice(0, 500) ?? ''}
            </Text>
          </ScrollView>
          <Pressable
            style={styles.button}
            onPress={() => this.setState({ hasError: false, error: null })}
          >
            <Text variant="body" style={styles.buttonText}>
              Try Again
            </Text>
          </Pressable>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.lg,
    justifyContent: 'center',
  },
  title: {
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  scroll: {
    maxHeight: 300,
    marginBottom: spacing.lg,
  },
  message: {
    marginBottom: spacing.sm,
  },
  stack: {
    fontFamily: 'monospace',
    fontSize: 10,
  },
  button: {
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
  },
});
