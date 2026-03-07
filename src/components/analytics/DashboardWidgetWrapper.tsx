import * as React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import { useTheme } from '@/theme';

interface DashboardWidgetWrapperProps {
  id: string;
  isEditMode: boolean;
  children: React.ReactNode;
}

export function DashboardWidgetWrapper({
  id,
  isEditMode,
  children,
}: DashboardWidgetWrapperProps): React.ReactElement {
  const { colors, spacing } = useTheme();
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    marginBottom: spacing.md,
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

export default DashboardWidgetWrapper;
