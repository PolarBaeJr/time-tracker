import * as React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';

import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import {
  useDashboardLayout,
  toggleWidgetVisibility,
  resetToDefault,
  setEditMode,
} from '@/stores/dashboardStore';
import type { DashboardWidgetId } from '@/stores/dashboardStore';
import { useTheme } from '@/theme';

const WIDGET_DISPLAY_NAMES: Record<DashboardWidgetId, string> = {
  kpi: 'Overview',
  pomodoro: 'Pomodoro Stats',
  goals: 'Goal Progress',
  'daily-chart': 'Daily Chart',
  'weekly-chart': 'Weekly Chart',
  'monthly-chart': 'Monthly Chart',
  'earnings-chart': 'Monthly Earnings',
  heatmap: 'Activity Heatmap',
};

export function DashboardEditPanel(): React.ReactElement {
  const { widgets } = useDashboardLayout();
  const { colors, spacing } = useTheme();

  return (
    <Card padding="md" style={styles.card}>
      <Text variant="label" style={styles.title}>
        Customize Dashboard
      </Text>

      {widgets.map(widget => (
        <Pressable
          key={widget.id}
          onPress={() => toggleWidgetVisibility(widget.id)}
          style={[styles.widgetRow, { borderBottomColor: colors.border }]}
        >
          <Text variant="body">{WIDGET_DISPLAY_NAMES[widget.id]}</Text>
          <Icon
            name={widget.visible ? 'check' : 'close'}
            size={18}
            color={widget.visible ? colors.success : colors.textMuted}
          />
        </Pressable>
      ))}

      <View style={[styles.actions, { marginTop: spacing.md }]}>
        <Button variant="ghost" size="sm" onPress={resetToDefault}>
          Reset to Default
        </Button>
        <Button variant="primary" size="sm" onPress={() => setEditMode(false)}>
          Done
        </Button>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 16,
  },
  title: {
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  widgetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});

export default DashboardEditPanel;
