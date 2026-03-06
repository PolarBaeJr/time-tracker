import * as React from 'react';
import {
  Alert,
  Platform,
  StyleSheet,
  View,
} from 'react-native';

import { GoogleSignInButton } from '@/components/auth';
import { Card, Spinner, Text } from '@/components/ui';
import { useAuth } from '@/hooks';
import { borderRadius, colors, spacing } from '@/theme';

function showAuthError(message: string): void {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.alert(message);
    return;
  }

  Alert.alert('Google sign-in failed', message);
}

export function LoginScreen(): React.ReactElement {
  const { loading, signInWithGoogle } = useAuth();
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const handleGoogleSignIn = async (): Promise<void> => {
    setErrorMessage(null);

    try {
      await signInWithGoogle();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to start Google sign-in.';

      setErrorMessage(message);
      showAuthError(message);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.logoMark}>
        <Text variant="heading" center>
          WT
        </Text>
      </View>

      <Text variant="display" center style={styles.title}>
        WorkTracker
      </Text>
      <Text variant="body" color="secondary" center style={styles.subtitle}>
        Keep your timers in sync across devices and sign in with your Google account.
      </Text>

      <Card style={styles.card} elevation="md">
        <Text variant="headingSmall" center style={styles.cardTitle}>
          Sign in to continue
        </Text>
        <Text variant="bodySmall" color="muted" center style={styles.cardBody}>
          Supabase handles the secure Google OAuth flow and restores your profile automatically.
        </Text>

        <GoogleSignInButton loading={loading} onPress={() => void handleGoogleSignIn()} />

        {loading && <Spinner message="Opening Google sign-in..." center style={styles.spinner} />}

        {errorMessage ? (
          <View style={styles.errorBanner}>
            <Text variant="bodySmall" color="error" center>
              {errorMessage}
            </Text>
          </View>
        ) : null}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: colors.background,
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  logoMark: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.primary,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    height: 88,
    justifyContent: 'center',
    marginBottom: spacing.lg,
    width: 88,
  },
  title: {
    marginBottom: spacing.sm,
  },
  subtitle: {
    marginBottom: spacing.xl,
    maxWidth: 420,
  },
  card: {
    maxWidth: 420,
    width: '100%',
  },
  cardTitle: {
    marginBottom: spacing.sm,
  },
  cardBody: {
    marginBottom: spacing.lg,
  },
  spinner: {
    marginTop: spacing.md,
    paddingHorizontal: 0,
  },
  errorBanner: {
    backgroundColor: colors.overlayLight,
    borderColor: colors.error,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginTop: spacing.md,
    padding: spacing.sm,
  },
});

export default LoginScreen;
