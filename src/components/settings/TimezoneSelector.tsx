/**
 * TimezoneSelector component
 *
 * Searchable dropdown of IANA timezones with current timezone highlighted.
 * Updates user profile on selection.
 */

import * as React from 'react';
import { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  Modal,
  StyleSheet,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/ui';
import { colors, spacing, fontSizes, fontWeights, borderRadius } from '@/theme';

/**
 * Common IANA timezones grouped by region
 * This is a curated list of commonly used timezones
 */
const TIMEZONES: string[] = [
  // UTC
  'UTC',
  // Americas
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Phoenix',
  'America/Anchorage',
  'America/Honolulu',
  'America/Toronto',
  'America/Vancouver',
  'America/Montreal',
  'America/Edmonton',
  'America/Winnipeg',
  'America/Mexico_City',
  'America/Tijuana',
  'America/Bogota',
  'America/Lima',
  'America/Caracas',
  'America/Santiago',
  'America/Buenos_Aires',
  'America/Sao_Paulo',
  // Europe
  'Europe/London',
  'Europe/Dublin',
  'Europe/Lisbon',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Madrid',
  'Europe/Rome',
  'Europe/Amsterdam',
  'Europe/Brussels',
  'Europe/Vienna',
  'Europe/Zurich',
  'Europe/Stockholm',
  'Europe/Oslo',
  'Europe/Copenhagen',
  'Europe/Helsinki',
  'Europe/Warsaw',
  'Europe/Prague',
  'Europe/Budapest',
  'Europe/Bucharest',
  'Europe/Athens',
  'Europe/Istanbul',
  'Europe/Moscow',
  'Europe/Kiev',
  // Asia
  'Asia/Dubai',
  'Asia/Tehran',
  'Asia/Karachi',
  'Asia/Kolkata',
  'Asia/Dhaka',
  'Asia/Bangkok',
  'Asia/Singapore',
  'Asia/Hong_Kong',
  'Asia/Shanghai',
  'Asia/Taipei',
  'Asia/Seoul',
  'Asia/Tokyo',
  'Asia/Manila',
  'Asia/Jakarta',
  'Asia/Kuala_Lumpur',
  // Australia & Pacific
  'Australia/Perth',
  'Australia/Adelaide',
  'Australia/Darwin',
  'Australia/Brisbane',
  'Australia/Sydney',
  'Australia/Melbourne',
  'Australia/Hobart',
  'Pacific/Auckland',
  'Pacific/Fiji',
  'Pacific/Guam',
  // Africa
  'Africa/Cairo',
  'Africa/Johannesburg',
  'Africa/Lagos',
  'Africa/Nairobi',
  'Africa/Casablanca',
];

/**
 * Get friendly display name for a timezone
 */
function getTimezoneDisplayName(tz: string): string {
  // Replace underscores with spaces and format nicely
  return tz.replace(/_/g, ' ');
}

/**
 * Get current UTC offset for a timezone
 */
function getTimezoneOffset(tz: string): string {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      timeZoneName: 'shortOffset',
    });
    const parts = formatter.formatToParts(now);
    const offsetPart = parts.find((part) => part.type === 'timeZoneName');
    return offsetPart?.value ?? '';
  } catch {
    return '';
  }
}

export interface TimezoneSelectorProps {
  /** Currently selected timezone */
  value: string;
  /** Callback when timezone is selected */
  onChange: (timezone: string) => void;
  /** Whether the selector is disabled */
  disabled?: boolean;
  /** Loading state */
  loading?: boolean;
  /** Additional styles */
  style?: ViewStyle;
}

/**
 * TimezoneSelector component
 *
 * @example
 * ```tsx
 * <TimezoneSelector
 *   value={settings.timezone}
 *   onChange={handleTimezoneChange}
 * />
 * ```
 */
export function TimezoneSelector({
  value,
  onChange,
  disabled = false,
  loading = false,
  style,
}: TimezoneSelectorProps): React.ReactElement {
  const [modalVisible, setModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Filter timezones based on search query
  const filteredTimezones = useMemo(() => {
    if (!searchQuery.trim()) {
      return TIMEZONES;
    }
    const query = searchQuery.toLowerCase();
    return TIMEZONES.filter(
      (tz) =>
        tz.toLowerCase().includes(query) ||
        getTimezoneDisplayName(tz).toLowerCase().includes(query)
    );
  }, [searchQuery]);

  const handleOpenModal = useCallback(() => {
    if (!disabled) {
      setModalVisible(true);
      setSearchQuery('');
    }
  }, [disabled]);

  const handleCloseModal = useCallback(() => {
    setModalVisible(false);
    setSearchQuery('');
  }, []);

  const handleSelectTimezone = useCallback(
    (timezone: string) => {
      onChange(timezone);
      handleCloseModal();
    },
    [onChange, handleCloseModal]
  );

  const renderTimezoneItem = useCallback(
    ({ item }: { item: string }) => {
      const isSelected = item === value;
      const offset = getTimezoneOffset(item);
      const displayName = getTimezoneDisplayName(item);

      return (
        <Pressable
          onPress={() => handleSelectTimezone(item)}
          style={[styles.timezoneItem, isSelected && styles.timezoneItemSelected]}
          accessibilityRole="button"
          accessibilityState={{ selected: isSelected }}
          accessibilityLabel={`${displayName} ${offset}`}
        >
          <View style={styles.timezoneInfo}>
            <Text
              style={[styles.timezoneName, isSelected && styles.timezoneNameSelected]}
              numberOfLines={1}
            >
              {displayName}
            </Text>
            <Text style={styles.timezoneOffset}>{offset}</Text>
          </View>
          {isSelected && (
            <Text style={styles.checkmark}>✓</Text>
          )}
        </Pressable>
      );
    },
    [value, handleSelectTimezone]
  );

  const displayName = getTimezoneDisplayName(value);
  const offset = getTimezoneOffset(value);

  return (
    <View style={[styles.container, style]}>
      <Text style={styles.label}>Timezone</Text>
      <Pressable
        onPress={handleOpenModal}
        disabled={disabled || loading}
        style={[
          styles.selector,
          disabled && styles.selectorDisabled,
        ]}
        accessibilityRole="button"
        accessibilityLabel={`Timezone: ${displayName}`}
        accessibilityHint="Tap to change timezone"
      >
        <View style={styles.selectorContent}>
          <Text
            style={[styles.selectorText, disabled && styles.selectorTextDisabled]}
            numberOfLines={1}
          >
            {displayName}
          </Text>
          <Text style={styles.selectorOffset}>{offset}</Text>
        </View>
        {loading ? (
          <Text style={styles.chevron}>...</Text>
        ) : (
          <Text style={styles.chevron}>›</Text>
        )}
      </Pressable>

      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handleCloseModal}
      >
        <SafeAreaView style={styles.modalContainer} edges={['top', 'bottom']}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Timezone</Text>
            <Button
              variant="ghost"
              size="sm"
              onPress={handleCloseModal}
            >
              Done
            </Button>
          </View>

          <View style={styles.searchContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search timezones..."
              placeholderTextColor={colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
            />
          </View>

          <FlatList
            data={filteredTimezones}
            keyExtractor={(item) => item}
            renderItem={renderTimezoneItem}
            style={styles.list}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
            initialNumToRender={20}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No timezones found</Text>
              </View>
            }
          />
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.medium,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surfaceVariant,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 48,
  },
  selectorDisabled: {
    backgroundColor: colors.surface,
    opacity: 0.6,
  },
  selectorContent: {
    flex: 1,
    marginRight: spacing.sm,
  },
  selectorText: {
    fontSize: fontSizes.md,
    color: colors.text,
  },
  selectorTextDisabled: {
    color: colors.textMuted,
  },
  selectorOffset: {
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  chevron: {
    fontSize: fontSizes.lg,
    color: colors.textSecondary,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.semibold,
    color: colors.text,
  },
  searchContainer: {
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  searchInput: {
    height: 44,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surfaceVariant,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    fontSize: fontSizes.md,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingVertical: spacing.sm,
  },
  timezoneItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  timezoneItemSelected: {
    backgroundColor: colors.surfaceVariant,
  },
  timezoneInfo: {
    flex: 1,
    marginRight: spacing.sm,
  },
  timezoneName: {
    fontSize: fontSizes.md,
    color: colors.text,
  },
  timezoneNameSelected: {
    color: colors.primary,
    fontWeight: fontWeights.semibold,
  },
  timezoneOffset: {
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  checkmark: {
    fontSize: fontSizes.lg,
    color: colors.primary,
    fontWeight: fontWeights.bold,
  },
  emptyContainer: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: fontSizes.md,
    color: colors.textMuted,
  },
});

export default TimezoneSelector;
