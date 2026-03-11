/**
 * AISettings
 *
 * Settings component for AI provider integration.
 * Supports Claude, OpenAI, and Ollama (local) providers.
 * Web/Electron only — handles API key configuration securely.
 */

import * as React from 'react';
import { View, StyleSheet, Pressable, TextInput, Platform } from 'react-native';
import { Text, Button, Icon } from '@/components/ui';
import { useAIConnection, useConfigureAI, useDisconnectAI } from '@/hooks/useAI';
import { useTheme } from '@/theme';
import type { AIProviderType } from '@/lib/ai';

// Provider display info
const PROVIDERS: { id: AIProviderType; name: string; color: string }[] = [
  { id: 'claude', name: 'Claude', color: '#D97706' },
  { id: 'openai', name: 'OpenAI', color: '#10A37F' },
  { id: 'ollama', name: 'Ollama', color: '#6366F1' },
];

// Available models per provider
const PROVIDER_MODELS: Record<AIProviderType, string[]> = {
  claude: ['claude-sonnet-4-20250514', 'claude-opus-4-20250514', 'claude-haiku-4-5-20251001'],
  openai: ['gpt-4o', 'gpt-4o-mini'],
  ollama: ['llama3', 'mistral', 'codellama'],
};

// Default models per provider
const DEFAULT_MODELS: Record<AIProviderType, string> = {
  claude: 'claude-sonnet-4-20250514',
  openai: 'gpt-4o',
  ollama: 'llama3',
};

export interface AISettingsProps {
  disabled?: boolean;
}

function AISettingsContent({ disabled = false }: AISettingsProps): React.ReactElement {
  const { colors, spacing, borderRadius, fontSizes } = useTheme();
  const { data: connection, isLoading } = useAIConnection();
  const configureMutation = useConfigureAI();
  const disconnectMutation = useDisconnectAI();

  // Local form state
  const [selectedProvider, setSelectedProvider] = React.useState<AIProviderType>('claude');
  const [apiKey, setApiKey] = React.useState('');
  const [selectedModel, setSelectedModel] = React.useState(DEFAULT_MODELS.claude);
  const [baseUrl, setBaseUrl] = React.useState('http://localhost:11434');
  const [showApiKey, setShowApiKey] = React.useState(false);
  const [testResult, setTestResult] = React.useState<{ success: boolean; message: string } | null>(
    null
  );

  // Check if connected
  const isConnected = !!connection?.is_active;
  const connectedProvider = connection?.provider as AIProviderType | undefined;

  // Update selected model when provider changes
  React.useEffect(() => {
    setSelectedModel(DEFAULT_MODELS[selectedProvider]);
    setTestResult(null);
  }, [selectedProvider]);

  // Validate base URL for Ollama
  const isValidBaseUrl = (url: string): boolean => {
    return url.startsWith('http://') || url.startsWith('https://');
  };

  // Handle test connection
  const handleTestConnection = async () => {
    setTestResult(null);

    // Validate inputs
    if (selectedProvider !== 'ollama' && !apiKey.trim()) {
      setTestResult({ success: false, message: 'Please enter an API key' });
      return;
    }

    if (selectedProvider === 'ollama' && !isValidBaseUrl(baseUrl)) {
      setTestResult({ success: false, message: 'Base URL must start with http:// or https://' });
      return;
    }

    try {
      await configureMutation.mutateAsync({
        provider: selectedProvider,
        apiKey: selectedProvider === 'ollama' ? 'not-required' : apiKey.trim(),
        model: selectedModel,
        baseUrl: selectedProvider === 'ollama' ? baseUrl : undefined,
      });
      setTestResult({ success: true, message: 'Connected successfully!' });
      setApiKey(''); // Clear API key from form after successful save
    } catch (err) {
      // Generic error message - never expose API key details
      setTestResult({
        success: false,
        message: 'Connection failed. Please check your configuration.',
      });
    }
  };

  // Handle disconnect
  const handleDisconnect = async () => {
    try {
      await disconnectMutation.mutateAsync();
      setTestResult(null);
    } catch {
      // Silent fail - UI will update via query invalidation
    }
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Text style={{ fontSize: fontSizes.sm, color: colors.textMuted }}>Loading...</Text>
      </View>
    );
  }

  // Connected state
  if (isConnected && connectedProvider) {
    const providerInfo = PROVIDERS.find(p => p.id === connectedProvider);
    return (
      <View style={styles.container}>
        <View style={styles.connectedRow}>
          <View style={styles.info}>
            <View style={styles.statusRow}>
              <View style={[styles.statusDot, { backgroundColor: '#22C55E' }]} />
              <Text style={{ fontSize: fontSizes.md, color: colors.text, fontWeight: '500' }}>
                Connected to {providerInfo?.name || connectedProvider}
              </Text>
            </View>
            {connection.model && (
              <Text style={{ fontSize: fontSizes.sm, color: colors.textSecondary }}>
                Model: {connection.model}
              </Text>
            )}
          </View>
          <Pressable
            style={[
              styles.disconnectButton,
              {
                backgroundColor: colors.surfaceVariant,
                borderRadius: borderRadius.md,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
              },
            ]}
            onPress={handleDisconnect}
            disabled={disabled || disconnectMutation.isPending}
            accessibilityRole="button"
            accessibilityLabel="Disconnect AI provider"
          >
            <Text style={{ fontSize: fontSizes.sm, color: colors.error, fontWeight: '500' }}>
              {disconnectMutation.isPending ? 'Disconnecting...' : 'Disconnect'}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // Configuration state
  return (
    <View style={styles.container}>
      {/* Provider Tabs */}
      <View style={styles.section}>
        <Text
          style={{ fontSize: fontSizes.sm, color: colors.textSecondary, marginBottom: spacing.xs }}
        >
          Provider
        </Text>
        <View style={styles.providerTabs}>
          {PROVIDERS.map(provider => {
            const isActive = selectedProvider === provider.id;
            return (
              <Pressable
                key={provider.id}
                style={[
                  styles.providerTab,
                  {
                    backgroundColor: isActive ? provider.color : colors.surfaceVariant,
                    borderRadius: borderRadius.md,
                    paddingHorizontal: spacing.md,
                    paddingVertical: spacing.sm,
                  },
                ]}
                onPress={() => setSelectedProvider(provider.id)}
                disabled={disabled}
                accessibilityRole="button"
                accessibilityLabel={`Select ${provider.name}`}
                accessibilityState={{ selected: isActive }}
              >
                <Text
                  style={{
                    fontSize: fontSizes.sm,
                    color: isActive ? '#FFFFFF' : colors.text,
                    fontWeight: isActive ? '600' : '400',
                  }}
                >
                  {provider.name}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* API Key Input (not for Ollama) */}
      {selectedProvider !== 'ollama' && (
        <View style={styles.section}>
          <Text
            style={{
              fontSize: fontSizes.sm,
              color: colors.textSecondary,
              marginBottom: spacing.xs,
            }}
          >
            API Key
          </Text>
          <View style={styles.inputRow}>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.surfaceVariant,
                  borderRadius: borderRadius.md,
                  color: colors.text,
                  fontSize: fontSizes.md,
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.sm,
                },
              ]}
              value={apiKey}
              onChangeText={setApiKey}
              placeholder={`Enter your ${selectedProvider === 'claude' ? 'Anthropic' : 'OpenAI'} API key`}
              placeholderTextColor={colors.textMuted}
              secureTextEntry={!showApiKey}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!disabled}
            />
            <Pressable
              style={styles.toggleButton}
              onPress={() => setShowApiKey(!showApiKey)}
              accessibilityRole="button"
              accessibilityLabel={showApiKey ? 'Hide API key' : 'Show API key'}
            >
              <Icon name={showApiKey ? 'eye-off' : 'eye'} size={20} color={colors.textSecondary} />
            </Pressable>
          </View>
        </View>
      )}

      {/* Base URL for Ollama */}
      {selectedProvider === 'ollama' && (
        <View style={styles.section}>
          <Text
            style={{
              fontSize: fontSizes.sm,
              color: colors.textSecondary,
              marginBottom: spacing.xs,
            }}
          >
            Base URL
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: colors.surfaceVariant,
                borderRadius: borderRadius.md,
                color: colors.text,
                fontSize: fontSizes.md,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
              },
            ]}
            value={baseUrl}
            onChangeText={setBaseUrl}
            placeholder="http://localhost:11434"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            editable={!disabled}
          />
          <Text style={{ fontSize: fontSizes.xs, color: colors.textMuted, marginTop: spacing.xs }}>
            Make sure Ollama is running on your machine
          </Text>
        </View>
      )}

      {/* Model Selection */}
      <View style={styles.section}>
        <Text
          style={{ fontSize: fontSizes.sm, color: colors.textSecondary, marginBottom: spacing.xs }}
        >
          Model
        </Text>
        <View style={styles.modelTabs}>
          {PROVIDER_MODELS[selectedProvider].map(model => {
            const isActive = selectedModel === model;
            return (
              <Pressable
                key={model}
                style={[
                  styles.modelTab,
                  {
                    backgroundColor: isActive ? colors.primary : colors.surfaceVariant,
                    borderRadius: borderRadius.sm,
                    paddingHorizontal: spacing.sm,
                    paddingVertical: spacing.xs,
                  },
                ]}
                onPress={() => setSelectedModel(model)}
                disabled={disabled}
                accessibilityRole="button"
                accessibilityLabel={`Select model ${model}`}
                accessibilityState={{ selected: isActive }}
              >
                <Text
                  style={{
                    fontSize: fontSizes.xs,
                    color: isActive ? '#FFFFFF' : colors.text,
                    fontWeight: isActive ? '500' : '400',
                  }}
                >
                  {model}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Test Result */}
      {testResult && (
        <View
          style={[
            styles.testResult,
            {
              backgroundColor: testResult.success
                ? 'rgba(34, 197, 94, 0.1)'
                : 'rgba(239, 68, 68, 0.1)',
              borderRadius: borderRadius.md,
              padding: spacing.sm,
            },
          ]}
        >
          <Icon
            name={testResult.success ? 'check' : 'alert'}
            size={16}
            color={testResult.success ? '#22C55E' : '#EF4444'}
          />
          <Text
            style={{
              fontSize: fontSizes.sm,
              color: testResult.success ? '#22C55E' : '#EF4444',
              marginLeft: spacing.xs,
            }}
          >
            {testResult.message}
          </Text>
        </View>
      )}

      {/* Connect Button */}
      <Button
        onPress={handleTestConnection}
        disabled={disabled || configureMutation.isPending}
        variant="primary"
        size="md"
      >
        {configureMutation.isPending ? 'Connecting...' : 'Test & Connect'}
      </Button>
    </View>
  );
}

export function AISettings(props: AISettingsProps): React.ReactElement | null {
  // Web/Electron only for now
  if (Platform.OS !== 'web') return null;
  return <AISettingsContent {...props} />;
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  section: {
    gap: 4,
  },
  providerTabs: {
    flexDirection: 'row',
    gap: 8,
  },
  providerTab: {
    flex: 1,
    alignItems: 'center',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    minHeight: 44,
  },
  toggleButton: {
    position: 'absolute',
    right: 12,
    padding: 4,
  },
  modelTabs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  modelTab: {},
  testResult: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  connectedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  info: {
    flex: 1,
    gap: 4,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  disconnectButton: {},
});

export default AISettings;
