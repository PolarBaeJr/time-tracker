import * as React from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Text } from '@/components/ui';
import { borderRadius, colors, spacing } from '@/theme';

export interface GoogleSignInButtonProps {
  loading?: boolean;
  disabled?: boolean;
  onPress: () => void | Promise<void>;
}

export function GoogleSignInButton({
  loading = false,
  disabled = false,
  onPress,
}: GoogleSignInButtonProps): React.ReactElement {
  return (
    <Button
      variant="outline"
      size="lg"
      loading={loading}
      disabled={disabled}
      onPress={onPress}
      accessibilityLabel="Continue with Google"
      style={styles.button}
    >
      <View style={styles.content}>
        <View style={styles.badge} accessible={false}>
          <Text variant="label" style={styles.badgeText}>
            G
          </Text>
        </View>
        <Text variant="label" color="primary" style={styles.label}>
          Continue with Google
        </Text>
      </View>
    </Button>
  );
}

const styles = StyleSheet.create({
  button: {
    width: '100%',
  },
  content: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  badge: {
    alignItems: 'center',
    backgroundColor: colors.text,
    borderRadius: borderRadius.full,
    height: 28,
    justifyContent: 'center',
    marginRight: spacing.sm,
    width: 28,
  },
  badgeText: {
    color: colors.background,
    fontWeight: '700',
  },
  label: {
    letterSpacing: 0.2,
  },
});

export default GoogleSignInButton;
