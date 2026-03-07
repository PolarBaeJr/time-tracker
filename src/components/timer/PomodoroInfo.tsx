import * as React from 'react';
import { View, StyleSheet, type ViewStyle, type TextStyle } from 'react-native';

import { Text } from '@/components/ui';
import { colors, spacing, borderRadius } from '@/theme';
import type { PomodoroPhase } from '@/types';

export interface PomodoroInfoProps {
  phase: PomodoroPhase;
  pomodorosCompleted: number;
  pomodorosBeforeLongBreak: number;
  style?: ViewStyle;
}

const PHASE_LABELS: Record<PomodoroPhase, string> = {
  work: 'Focus',
  break: 'Short Break',
  long_break: 'Long Break',
};

const PHASE_COLORS: Record<PomodoroPhase, string> = {
  work: colors.primary,
  break: colors.success,
  long_break: colors.warning,
};

export function PomodoroInfo({
  phase,
  pomodorosCompleted,
  pomodorosBeforeLongBreak,
  style,
}: PomodoroInfoProps): React.ReactElement {
  return (
    <View style={[styles.container, style]}>
      <View style={[styles.phaseBadge, { backgroundColor: PHASE_COLORS[phase] + '20' }]}>
        <Text
          variant="bodySmall"
          style={
            StyleSheet.flatten([styles.phaseText, { color: PHASE_COLORS[phase] }]) as TextStyle
          }
        >
          {PHASE_LABELS[phase]}
        </Text>
      </View>
      <View style={styles.dots}>
        {Array.from({ length: pomodorosBeforeLongBreak }).map((_, i) => (
          <View key={i} style={[styles.dot, i < pomodorosCompleted && styles.dotCompleted]} />
        ))}
      </View>
      <Text variant="caption" color="muted">
        {pomodorosCompleted}/{pomodorosBeforeLongBreak} pomodoros
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  phaseBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  phaseText: {
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontSize: 12,
  },
  dots: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.surfaceVariant,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dotCompleted: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
});

export default PomodoroInfo;
