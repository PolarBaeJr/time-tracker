/**
 * UI components barrel export
 *
 * All base UI components are exported from this file.
 * Import from '@/components/ui' for all UI primitives.
 */

// Button component
export { Button, type ButtonProps, type ButtonVariant, type ButtonSize } from './Button';

// Input component
export { Input, type InputProps } from './Input';

// Card component
export { Card, type CardProps, type CardPadding, type CardElevation } from './Card';

// Text component
export { Text, type TextProps, type TextVariant, type TextColor } from './Text';

// Spinner component
export { Spinner, type SpinnerProps, type SpinnerSize } from './Spinner';

// ColorPicker component
export { ColorPicker, type ColorPickerProps, PRESET_COLORS } from './ColorPicker';

// Icon component
export { Icon, type IconProps, type IconName, iconMap } from './Icon';

// OfflineBanner component
export { OfflineBanner, type OfflineBannerProps } from './OfflineBanner';

// AnimatedView component
export {
  AnimatedView,
  type AnimatedViewProps,
  type AnimationPreset,
  type AnimatedViewImperativeHandle,
} from './AnimatedView';

// Toast components
export { Toast, type ToastProps } from './Toast';
export { ToastContainer, type ToastContainerProps, type ToastPosition } from './ToastContainer';
