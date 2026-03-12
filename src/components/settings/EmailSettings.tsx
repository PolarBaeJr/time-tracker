/**
 * EmailSettings
 *
 * Settings component for email integration.
 * Supports Gmail, Outlook, and IMAP providers.
 * Web/Electron only — hidden on native platforms.
 */

import * as React from 'react';
import { View, StyleSheet, Pressable, TextInput, Platform } from 'react-native';
import { Text, Button, Icon } from '@/components/ui';
import {
  useEmailConnections,
  useConnectGmail,
  useConnectOutlook,
  useConnectIMAP,
  useDisconnectEmail,
  useSyncEmails,
  useToggleEmailConnection,
} from '@/hooks/useEmail';
import { useTheme } from '@/theme';
import type { EmailProvider, EmailConnection } from '@/schemas';

// Provider display info
const EMAIL_PROVIDERS: { id: EmailProvider; name: string; color: string; icon: string }[] = [
  { id: 'gmail', name: 'Gmail', color: '#EA4335', icon: 'mail' },
  { id: 'outlook', name: 'Outlook', color: '#0078D4', icon: 'mail' },
  { id: 'imap', name: 'IMAP', color: '#6B7280', icon: 'server' },
];

export interface EmailSettingsProps {
  disabled?: boolean;
}

/** IMAP configuration form state */
interface IMAPFormState {
  emailAddress: string;
  imapServer: string;
  imapPort: string;
  username: string;
  password: string;
}

const INITIAL_IMAP_STATE: IMAPFormState = {
  emailAddress: '',
  imapServer: '',
  imapPort: '993',
  username: '',
  password: '',
};

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

interface EmailProviderSelectorProps {
  selectedProvider: EmailProvider;
  onSelectProvider: (provider: EmailProvider) => void;
  disabled?: boolean;
}

function EmailProviderSelector({
  selectedProvider,
  onSelectProvider,
  disabled,
}: EmailProviderSelectorProps): React.ReactElement {
  const { colors, spacing, borderRadius, fontSizes } = useTheme();

  return (
    <View style={styles.providerTabs}>
      {EMAIL_PROVIDERS.map(provider => {
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
            onPress={() => onSelectProvider(provider.id)}
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
  );
}

interface IMAPConfigFormProps {
  form: IMAPFormState;
  onFormChange: (form: IMAPFormState) => void;
  onSubmit: () => void;
  isPending: boolean;
  disabled?: boolean;
  error?: string | null;
}

function IMAPConfigForm({
  form,
  onFormChange,
  onSubmit,
  isPending,
  disabled,
  error,
}: IMAPConfigFormProps): React.ReactElement {
  const { colors, spacing, borderRadius, fontSizes } = useTheme();
  const [showPassword, setShowPassword] = React.useState(false);

  const updateField = (field: keyof IMAPFormState, value: string) => {
    onFormChange({ ...form, [field]: value });
  };

  const isValid =
    form.emailAddress.includes('@') &&
    form.imapServer.length > 0 &&
    form.imapPort.length > 0 &&
    form.username.length > 0 &&
    form.password.length > 0;

  return (
    <View style={styles.imapForm}>
      {/* Email Address */}
      <View style={styles.formField}>
        <Text
          style={{ fontSize: fontSizes.sm, color: colors.textSecondary, marginBottom: spacing.xs }}
        >
          Email Address
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
          value={form.emailAddress}
          onChangeText={v => updateField('emailAddress', v)}
          placeholder="you@example.com"
          placeholderTextColor={colors.textMuted}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          editable={!disabled && !isPending}
        />
      </View>

      {/* IMAP Server */}
      <View style={styles.formField}>
        <Text
          style={{ fontSize: fontSizes.sm, color: colors.textSecondary, marginBottom: spacing.xs }}
        >
          IMAP Server
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
          value={form.imapServer}
          onChangeText={v => updateField('imapServer', v)}
          placeholder="imap.example.com"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          editable={!disabled && !isPending}
        />
      </View>

      {/* IMAP Port */}
      <View style={styles.formField}>
        <Text
          style={{ fontSize: fontSizes.sm, color: colors.textSecondary, marginBottom: spacing.xs }}
        >
          Port
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
          value={form.imapPort}
          onChangeText={v => updateField('imapPort', v)}
          placeholder="993"
          placeholderTextColor={colors.textMuted}
          keyboardType="number-pad"
          editable={!disabled && !isPending}
        />
      </View>

      {/* Username */}
      <View style={styles.formField}>
        <Text
          style={{ fontSize: fontSizes.sm, color: colors.textSecondary, marginBottom: spacing.xs }}
        >
          Username
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
          value={form.username}
          onChangeText={v => updateField('username', v)}
          placeholder="Username or email"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          editable={!disabled && !isPending}
        />
      </View>

      {/* Password */}
      <View style={styles.formField}>
        <Text
          style={{ fontSize: fontSizes.sm, color: colors.textSecondary, marginBottom: spacing.xs }}
        >
          Password
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
            value={form.password}
            onChangeText={v => updateField('password', v)}
            placeholder="Password"
            placeholderTextColor={colors.textMuted}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!disabled && !isPending}
          />
          <Pressable
            style={styles.toggleButton}
            onPress={() => setShowPassword(!showPassword)}
            accessibilityRole="button"
            accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
          >
            <Icon name={showPassword ? 'eye-off' : 'eye'} size={20} color={colors.textSecondary} />
          </Pressable>
        </View>
      </View>

      {/* Error message */}
      {error && (
        <View
          style={[
            styles.errorContainer,
            {
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              borderRadius: borderRadius.md,
              padding: spacing.sm,
            },
          ]}
        >
          <Icon name="alert" size={16} color="#EF4444" />
          <Text
            style={{
              fontSize: fontSizes.sm,
              color: '#EF4444',
              marginLeft: spacing.xs,
              flex: 1,
            }}
          >
            {error}
          </Text>
        </View>
      )}

      {/* Connect button */}
      <Button
        onPress={onSubmit}
        disabled={disabled || isPending || !isValid}
        variant="primary"
        size="md"
      >
        {isPending ? 'Connecting...' : 'Connect IMAP'}
      </Button>
    </View>
  );
}

interface EmailConnectionRowProps {
  connection: EmailConnection;
  onDisconnect: () => void;
  onSync: () => void;
  onToggle: (isActive: boolean) => void;
  isDisconnecting: boolean;
  isSyncing: boolean;
  isToggling: boolean;
  disabled?: boolean;
}

function EmailConnectionRow({
  connection,
  onDisconnect,
  onSync,
  onToggle,
  isDisconnecting,
  isSyncing,
  isToggling,
  disabled,
}: EmailConnectionRowProps): React.ReactElement {
  const { colors, spacing, borderRadius, fontSizes } = useTheme();

  const providerInfo = EMAIL_PROVIDERS.find(p => p.id === connection.provider);
  const isActive = connection.is_active;
  const hasError = !!connection.sync_error;

  const formatLastSync = (dateStr: string | null | undefined): string => {
    if (!dateStr) return 'Never synced';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  return (
    <View
      style={[
        styles.connectionRow,
        {
          backgroundColor: colors.surface,
          borderRadius: borderRadius.md,
          padding: spacing.md,
          borderWidth: 1,
          borderColor: hasError ? '#EF4444' : colors.border,
        },
      ]}
    >
      {/* Provider icon and info */}
      <View style={styles.connectionInfo}>
        <View style={styles.connectionHeader}>
          <View
            style={[
              styles.providerIcon,
              {
                backgroundColor: providerInfo?.color ?? colors.surfaceVariant,
                borderRadius: borderRadius.sm,
              },
            ]}
          >
            <Icon name={providerInfo?.icon ?? 'mail'} size={16} color="#FFFFFF" />
          </View>
          <View style={styles.connectionDetails}>
            <Text style={{ fontSize: fontSizes.md, color: colors.text, fontWeight: '500' }}>
              {connection.email_address}
            </Text>
            <View style={styles.statusRow}>
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: isActive ? '#22C55E' : colors.textMuted },
                ]}
              />
              <Text style={{ fontSize: fontSizes.xs, color: colors.textSecondary }}>
                {isActive ? 'Active' : 'Paused'} • {formatLastSync(connection.last_sync_at)}
              </Text>
            </View>
          </View>
        </View>

        {/* Sync error */}
        {hasError && (
          <Text
            style={{
              fontSize: fontSizes.xs,
              color: '#EF4444',
              marginTop: spacing.xs,
            }}
            numberOfLines={2}
          >
            {connection.sync_error}
          </Text>
        )}
      </View>

      {/* Actions */}
      <View style={styles.connectionActions}>
        {/* Toggle active */}
        <Pressable
          style={[
            styles.actionButton,
            {
              backgroundColor: colors.surfaceVariant,
              borderRadius: borderRadius.sm,
              paddingHorizontal: spacing.sm,
              paddingVertical: spacing.xs,
            },
          ]}
          onPress={() => onToggle(!isActive)}
          disabled={disabled || isToggling}
          accessibilityRole="button"
          accessibilityLabel={isActive ? 'Pause sync' : 'Resume sync'}
        >
          <Icon name={isActive ? 'pause' : 'play'} size={14} color={colors.textSecondary} />
        </Pressable>

        {/* Sync now */}
        <Pressable
          style={[
            styles.actionButton,
            {
              backgroundColor: colors.surfaceVariant,
              borderRadius: borderRadius.sm,
              paddingHorizontal: spacing.sm,
              paddingVertical: spacing.xs,
            },
          ]}
          onPress={onSync}
          disabled={disabled || isSyncing || !isActive}
          accessibilityRole="button"
          accessibilityLabel="Sync now"
        >
          <Icon
            name="refresh-cw"
            size={14}
            color={isSyncing ? colors.primary : colors.textSecondary}
          />
        </Pressable>

        {/* Disconnect */}
        <Pressable
          style={[
            styles.actionButton,
            {
              backgroundColor: colors.surfaceVariant,
              borderRadius: borderRadius.sm,
              paddingHorizontal: spacing.sm,
              paddingVertical: spacing.xs,
            },
          ]}
          onPress={onDisconnect}
          disabled={disabled || isDisconnecting}
          accessibilityRole="button"
          accessibilityLabel="Disconnect email"
        >
          <Icon name="trash" size={14} color="#EF4444" />
        </Pressable>
      </View>
    </View>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

function EmailSettingsContent({ disabled = false }: EmailSettingsProps): React.ReactElement {
  const { colors, spacing, borderRadius, fontSizes } = useTheme();

  // Queries and mutations
  const { connections, hasConnections, isLoading } = useEmailConnections();
  const connectGmailMutation = useConnectGmail();
  const connectOutlookMutation = useConnectOutlook();
  const connectIMAPMutation = useConnectIMAP();
  const disconnectMutation = useDisconnectEmail();
  const syncMutation = useSyncEmails();
  const toggleMutation = useToggleEmailConnection();

  // Local state
  const [showAddForm, setShowAddForm] = React.useState(false);
  const [selectedProvider, setSelectedProvider] = React.useState<EmailProvider>('gmail');
  const [imapForm, setImapForm] = React.useState<IMAPFormState>(INITIAL_IMAP_STATE);
  const [imapError, setImapError] = React.useState<string | null>(null);

  // Track which connections are being operated on
  const [syncingIds, setSyncingIds] = React.useState<Set<string>>(new Set());
  const [disconnectingIds, setDisconnectingIds] = React.useState<Set<string>>(new Set());
  const [togglingIds, setTogglingIds] = React.useState<Set<string>>(new Set());

  // Reset form when provider changes
  React.useEffect(() => {
    setImapForm(INITIAL_IMAP_STATE);
    setImapError(null);
  }, [selectedProvider]);

  // Handle OAuth provider connection
  const handleConnectOAuth = async (provider: EmailProvider) => {
    if (provider === 'gmail') {
      await connectGmailMutation.mutateAsync();
    } else if (provider === 'outlook') {
      await connectOutlookMutation.mutateAsync();
    }
  };

  // Handle IMAP connection
  const handleConnectIMAP = async () => {
    setImapError(null);
    try {
      const portNumber = parseInt(imapForm.imapPort, 10);
      if (isNaN(portNumber) || portNumber < 1 || portNumber > 65535) {
        setImapError('Port must be between 1 and 65535');
        return;
      }

      await connectIMAPMutation.mutateAsync({
        email_address: imapForm.emailAddress,
        imap_server: imapForm.imapServer,
        imap_port: portNumber,
        imap_username: imapForm.username,
        imap_password: imapForm.password,
      });

      // Reset form on success
      setImapForm(INITIAL_IMAP_STATE);
      setShowAddForm(false);
    } catch (err) {
      setImapError('Failed to connect. Please check your credentials.');
    }
  };

  // Handle disconnect
  const handleDisconnect = async (connectionId: string) => {
    setDisconnectingIds(prev => new Set(prev).add(connectionId));
    try {
      await disconnectMutation.mutateAsync(connectionId);
    } finally {
      setDisconnectingIds(prev => {
        const next = new Set(prev);
        next.delete(connectionId);
        return next;
      });
    }
  };

  // Handle sync
  const handleSync = async (connectionId: string) => {
    setSyncingIds(prev => new Set(prev).add(connectionId));
    try {
      await syncMutation.mutateAsync(connectionId);
    } finally {
      setSyncingIds(prev => {
        const next = new Set(prev);
        next.delete(connectionId);
        return next;
      });
    }
  };

  // Handle toggle
  const handleToggle = async (connectionId: string, isActive: boolean) => {
    setTogglingIds(prev => new Set(prev).add(connectionId));
    try {
      await toggleMutation.mutateAsync({ connectionId, isActive });
    } finally {
      setTogglingIds(prev => {
        const next = new Set(prev);
        next.delete(connectionId);
        return next;
      });
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <View style={styles.container}>
        <Text style={{ fontSize: fontSizes.sm, color: colors.textMuted }}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Connected accounts list */}
      {hasConnections && (
        <View style={styles.connectionsList}>
          {connections.map(connection => (
            <EmailConnectionRow
              key={connection.id}
              connection={connection}
              onDisconnect={() => handleDisconnect(connection.id)}
              onSync={() => handleSync(connection.id)}
              onToggle={isActive => handleToggle(connection.id, isActive)}
              isDisconnecting={disconnectingIds.has(connection.id)}
              isSyncing={syncingIds.has(connection.id)}
              isToggling={togglingIds.has(connection.id)}
              disabled={disabled}
            />
          ))}
        </View>
      )}

      {/* Add email form */}
      {showAddForm ? (
        <View
          style={[
            styles.addForm,
            {
              backgroundColor: colors.surface,
              borderRadius: borderRadius.md,
              padding: spacing.md,
              borderWidth: 1,
              borderColor: colors.border,
            },
          ]}
        >
          <View style={styles.addFormHeader}>
            <Text style={{ fontSize: fontSizes.md, color: colors.text, fontWeight: '500' }}>
              Add Email Account
            </Text>
            <Pressable
              onPress={() => setShowAddForm(false)}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
            >
              <Icon name="x" size={20} color={colors.textSecondary} />
            </Pressable>
          </View>

          {/* Provider selector */}
          <View style={styles.section}>
            <Text
              style={{
                fontSize: fontSizes.sm,
                color: colors.textSecondary,
                marginBottom: spacing.xs,
              }}
            >
              Provider
            </Text>
            <EmailProviderSelector
              selectedProvider={selectedProvider}
              onSelectProvider={setSelectedProvider}
              disabled={disabled}
            />
          </View>

          {/* OAuth providers */}
          {(selectedProvider === 'gmail' || selectedProvider === 'outlook') && (
            <Button
              onPress={() => handleConnectOAuth(selectedProvider)}
              disabled={
                disabled || connectGmailMutation.isPending || connectOutlookMutation.isPending
              }
              variant="primary"
              size="md"
            >
              {connectGmailMutation.isPending || connectOutlookMutation.isPending
                ? 'Connecting...'
                : `Connect ${selectedProvider === 'gmail' ? 'Gmail' : 'Outlook'}`}
            </Button>
          )}

          {/* IMAP form */}
          {selectedProvider === 'imap' && (
            <IMAPConfigForm
              form={imapForm}
              onFormChange={setImapForm}
              onSubmit={handleConnectIMAP}
              isPending={connectIMAPMutation.isPending}
              disabled={disabled}
              error={imapError}
            />
          )}
        </View>
      ) : (
        /* Add email button */
        <Button
          onPress={() => setShowAddForm(true)}
          disabled={disabled}
          variant="secondary"
          size="md"
        >
          Add Email Account
        </Button>
      )}
    </View>
  );
}

export function EmailSettings(props: EmailSettingsProps): React.ReactElement | null {
  // Web/Electron only for now
  if (Platform.OS !== 'web') return null;
  return <EmailSettingsContent {...props} />;
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  connectionsList: {
    gap: 12,
  },
  connectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  connectionInfo: {
    flex: 1,
    gap: 4,
  },
  connectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  providerIcon: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  connectionDetails: {
    flex: 1,
    gap: 2,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  connectionActions: {
    flexDirection: 'row',
    gap: 8,
    marginLeft: 12,
  },
  actionButton: {
    padding: 8,
  },
  addForm: {
    gap: 16,
  },
  addFormHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  imapForm: {
    gap: 12,
  },
  formField: {
    gap: 4,
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
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});

export default EmailSettings;
