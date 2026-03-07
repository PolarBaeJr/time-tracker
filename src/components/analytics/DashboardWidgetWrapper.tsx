import * as React from 'react';
import { View, Platform } from 'react-native';

import { useTheme } from '@/theme';

interface DashboardWidgetWrapperProps {
  id: string;
  isEditMode: boolean;
  children: React.ReactNode;
}

// Web-only: lazy-load @dnd-kit to avoid crashing on native
function WebSortableWrapper({
  id,
  isEditMode,
  children,
}: DashboardWidgetWrapperProps): React.ReactElement {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { useSortable } = require('@dnd-kit/sortable');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { CSS } = require('@dnd-kit/utilities');
  const { colors } = useTheme();
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style}>
      {isEditMode && (
        <div
          {...attributes}
          {...listeners}
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: 6,
            marginBottom: 4,
            cursor: 'grab',
            color: colors.textSecondary,
            fontSize: 18,
            userSelect: 'none',
          }}
        >
          &#x2630;
        </div>
      )}
      {children}
    </div>
  );
}

export function DashboardWidgetWrapper(props: DashboardWidgetWrapperProps): React.ReactElement {
  if (Platform.OS === 'web') {
    return <WebSortableWrapper {...props} />;
  }

  // Native: just render children in a View (no drag-and-drop)
  return <View>{props.children}</View>;
}

export default DashboardWidgetWrapper;
