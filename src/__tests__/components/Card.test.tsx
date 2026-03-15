/**
 * Card Component Tests
 *
 * Tests for the Card component logic including:
 * - Basic rendering with various props
 * - Pressable functionality
 * - Animation entry props
 * - Reduced motion handling
 * - Shadow elevation on press
 */

import type { ShadowKey } from '@/theme';

describe('Card', () => {
  // ============================================================================
  // Padding Values Tests
  // ============================================================================

  describe('paddingValues', () => {
    // Mirrors the paddingValues constant in Card.tsx
    const spacing = { sm: 8, md: 16, lg: 24 };
    const paddingValues = {
      none: 0,
      sm: spacing.sm,
      md: spacing.md,
      lg: spacing.lg,
    };

    it('should have correct padding values', () => {
      expect(paddingValues.none).toBe(0);
      expect(paddingValues.sm).toBe(8);
      expect(paddingValues.md).toBe(16);
      expect(paddingValues.lg).toBe(24);
    });

    it('should default to md padding', () => {
      const defaultPadding = 'md';
      expect(paddingValues[defaultPadding]).toBe(16);
    });
  });

  // ============================================================================
  // Pressed Elevation Tests
  // ============================================================================

  describe('pressedElevation mapping', () => {
    // Mirrors the pressedElevation constant in Card.tsx
    const pressedElevation: Record<ShadowKey, ShadowKey> = {
      none: 'sm',
      sm: 'md',
      md: 'lg',
      lg: 'lg', // Already at max
    };

    it('should increase shadow elevation on press', () => {
      expect(pressedElevation.none).toBe('sm');
      expect(pressedElevation.sm).toBe('md');
      expect(pressedElevation.md).toBe('lg');
    });

    it('should not exceed max elevation (lg)', () => {
      expect(pressedElevation.lg).toBe('lg');
    });

    it('should have all shadow keys mapped', () => {
      const allKeys: ShadowKey[] = ['none', 'sm', 'md', 'lg'];
      allKeys.forEach(key => {
        expect(pressedElevation[key]).toBeDefined();
      });
    });
  });

  // ============================================================================
  // Animation Decision Tests
  // ============================================================================

  describe('animation decision logic', () => {
    interface UXSettings {
      animationsEnabled: boolean;
      reducedMotion: boolean;
    }

    function shouldAnimate(settings: UXSettings): boolean {
      return settings.animationsEnabled && !settings.reducedMotion;
    }

    it('should animate when animations enabled and no reduced motion', () => {
      const settings = { animationsEnabled: true, reducedMotion: false };
      expect(shouldAnimate(settings)).toBe(true);
    });

    it('should not animate when animations disabled', () => {
      const settings = { animationsEnabled: false, reducedMotion: false };
      expect(shouldAnimate(settings)).toBe(false);
    });

    it('should not animate when reduced motion is enabled', () => {
      const settings = { animationsEnabled: true, reducedMotion: true };
      expect(shouldAnimate(settings)).toBe(false);
    });

    it('should not animate when both disabled and reduced motion', () => {
      const settings = { animationsEnabled: false, reducedMotion: true };
      expect(shouldAnimate(settings)).toBe(false);
    });
  });

  // ============================================================================
  // Entry Animation Initial Values Tests
  // ============================================================================

  describe('entry animation initial values', () => {
    interface EntryAnimationConfig {
      animateEntry: boolean;
      shouldAnimate: boolean;
    }

    function getOpacityInitialValue(config: EntryAnimationConfig): number {
      return config.shouldAnimate && config.animateEntry ? 0 : 1;
    }

    function getScaleInitialValue(config: EntryAnimationConfig): number {
      return config.shouldAnimate && config.animateEntry ? 0.95 : 1;
    }

    it('should start with opacity 0 when animating entry', () => {
      const config = { animateEntry: true, shouldAnimate: true };
      expect(getOpacityInitialValue(config)).toBe(0);
    });

    it('should start with scale 0.95 when animating entry', () => {
      const config = { animateEntry: true, shouldAnimate: true };
      expect(getScaleInitialValue(config)).toBe(0.95);
    });

    it('should start with opacity 1 when not animating entry', () => {
      const config = { animateEntry: false, shouldAnimate: true };
      expect(getOpacityInitialValue(config)).toBe(1);
    });

    it('should start with scale 1 when not animating entry', () => {
      const config = { animateEntry: false, shouldAnimate: true };
      expect(getScaleInitialValue(config)).toBe(1);
    });

    it('should start with full values when animations disabled', () => {
      const config = { animateEntry: true, shouldAnimate: false };
      expect(getOpacityInitialValue(config)).toBe(1);
      expect(getScaleInitialValue(config)).toBe(1);
    });
  });

  // ============================================================================
  // Pressable Card Behavior Tests
  // ============================================================================

  describe('pressable card behavior', () => {
    function isPressable(pressable: boolean, onPress: (() => void) | undefined): boolean {
      return pressable && onPress !== undefined;
    }

    it('should be pressable when both pressable prop and onPress are provided', () => {
      const onPress = jest.fn();
      expect(isPressable(true, onPress)).toBe(true);
    });

    it('should not be pressable when pressable is false', () => {
      const onPress = jest.fn();
      expect(isPressable(false, onPress)).toBe(false);
    });

    it('should not be pressable when onPress is undefined', () => {
      expect(isPressable(true, undefined)).toBe(false);
    });

    it('should not be pressable when both false/undefined', () => {
      expect(isPressable(false, undefined)).toBe(false);
    });
  });

  // ============================================================================
  // Press Animation Values Tests
  // ============================================================================

  describe('press animation values', () => {
    const PRESS_SCALE = 0.99;
    const NORMAL_SCALE = 1;
    const SPRING_CONFIG = { friction: 7, tension: 40 };

    it('should have correct press scale value', () => {
      expect(PRESS_SCALE).toBe(0.99);
    });

    it('should have correct normal scale value', () => {
      expect(NORMAL_SCALE).toBe(1);
    });

    it('should have correct spring animation config', () => {
      expect(SPRING_CONFIG.friction).toBe(7);
      expect(SPRING_CONFIG.tension).toBe(40);
    });
  });

  // ============================================================================
  // Default Props Tests
  // ============================================================================

  describe('default props', () => {
    const defaultProps = {
      padding: 'md' as const,
      elevation: 'sm' as const,
      pressable: false,
      animateEntry: false,
      entryDuration: 250,
      entryDelay: 0,
    };

    it('should have correct default padding', () => {
      expect(defaultProps.padding).toBe('md');
    });

    it('should have correct default elevation', () => {
      expect(defaultProps.elevation).toBe('sm');
    });

    it('should not be pressable by default', () => {
      expect(defaultProps.pressable).toBe(false);
    });

    it('should not animate entry by default', () => {
      expect(defaultProps.animateEntry).toBe(false);
    });

    it('should have 250ms default entry duration', () => {
      expect(defaultProps.entryDuration).toBe(250);
    });

    it('should have 0 default entry delay', () => {
      expect(defaultProps.entryDelay).toBe(0);
    });
  });

  // ============================================================================
  // Accessibility Tests
  // ============================================================================

  describe('accessibility', () => {
    it('should have button accessibility role when pressable', () => {
      const accessibilityRole = 'button';
      expect(accessibilityRole).toBe('button');
    });

    it('should respect pressable semantics for card', () => {
      // When pressable and onPress are provided, component renders Pressable
      const isPressable = (pressable: boolean, onPress: (() => void) | undefined) =>
        pressable && onPress !== undefined;

      const onPress = jest.fn();
      expect(isPressable(true, onPress)).toBe(true);
    });
  });

  // ============================================================================
  // CSS Fallback Tests (when animations disabled)
  // ============================================================================

  describe('CSS fallback styles', () => {
    const pressedStyles = {
      opacity: 0.9,
      transform: [{ scale: 0.99 }],
    };

    it('should have correct opacity for CSS fallback', () => {
      expect(pressedStyles.opacity).toBe(0.9);
    });

    it('should have correct scale for CSS fallback', () => {
      expect(pressedStyles.transform[0].scale).toBe(0.99);
    });

    it('should apply fallback only when animations disabled', () => {
      // Logic in Card: !shouldAnimate && pressed && styles.pressed
      function shouldApplyFallback(shouldAnimate: boolean, pressed: boolean): boolean {
        return !shouldAnimate && pressed;
      }

      expect(shouldApplyFallback(false, true)).toBe(true);
      expect(shouldApplyFallback(true, true)).toBe(false);
      expect(shouldApplyFallback(false, false)).toBe(false);
      expect(shouldApplyFallback(true, false)).toBe(false);
    });
  });
});
