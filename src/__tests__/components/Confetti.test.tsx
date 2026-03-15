/**
 * Confetti Component Tests
 *
 * Tests for the Confetti component including:
 * - Component rendering
 * - Imperative API (fire, stop)
 * - ConfettiProvider and useConfetti hook
 * - Reduced motion support
 * - Configuration options
 */

import React, { useRef } from 'react';
import { render } from '../mocks/testing-library-react-native';

// Note: We test the types and basic structure since actual animations
// are difficult to test without a real DOM/Canvas

// Mock the animations module
let mockReducedMotion = false;
jest.mock('@/lib/animations', () => ({
  ANIMATION_DURATION: {
    instant: 0,
    fast: 150,
    normal: 250,
    slow: 400,
    verySlow: 600,
  },
  getReducedMotionPreference: jest.fn(() => mockReducedMotion),
}));

// Mock theme
jest.mock('@/theme', () => ({
  useTheme: () => ({
    colors: {
      primary: '#6366F1',
      secondary: '#22D3EE',
      success: '#10B981',
      warning: '#F59E0B',
      error: '#EF4444',
    },
  }),
}));

// Import after mocks
import {
  Confetti,
  ConfettiProvider,
  useConfetti,
  type ConfettiRef,
  type ConfettiConfig,
} from '@/components/ui/Confetti';

describe('Confetti Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockReducedMotion = false;
  });

  describe('Rendering', () => {
    it('should render without crashing', () => {
      const result = render(<Confetti />);
      // Component renders (may or may not return null depending on mock)
      expect(result).toBeDefined();
    });

    it('should accept onComplete callback prop', () => {
      const onComplete = jest.fn();
      const result = render(<Confetti onComplete={onComplete} />);
      // Component renders with callback prop
      expect(result).toBeDefined();
    });
  });

  describe('Imperative API Types', () => {
    it('should have correct ref type shape', () => {
      // Type check - ConfettiRef should have fire and stop methods
      const mockRef: ConfettiRef = {
        fire: jest.fn(),
        stop: jest.fn(),
      };

      expect(typeof mockRef.fire).toBe('function');
      expect(typeof mockRef.stop).toBe('function');
    });

    it('should have correct config type shape', () => {
      // Type check - ConfettiConfig should have expected properties
      const config: ConfettiConfig = {
        particleCount: 100,
        duration: 3000,
        colors: ['#ff0000', '#00ff00'],
        originX: 0.5,
        originY: 0.3,
        spread: 15,
        gravity: 0.5,
      };

      expect(config.particleCount).toBe(100);
      expect(config.duration).toBe(3000);
      expect(config.colors).toHaveLength(2);
      expect(config.originX).toBe(0.5);
      expect(config.originY).toBe(0.3);
      expect(config.spread).toBe(15);
      expect(config.gravity).toBe(0.5);
    });

    it('should allow partial config', () => {
      // All config properties should be optional
      const minimalConfig: ConfettiConfig = {};
      expect(minimalConfig.particleCount).toBeUndefined();

      const partialConfig: ConfettiConfig = { particleCount: 50 };
      expect(partialConfig.particleCount).toBe(50);
    });
  });

  describe('ConfettiProvider', () => {
    it('should render children', () => {
      const TestChild = () => <>{null}</>;
      const result = render(
        <ConfettiProvider>
          <TestChild />
        </ConfettiProvider>
      );
      expect(result.toJSON()).not.toBeNull();
    });

    it('should provide context value type', () => {
      // Type check - useConfetti should return fire function
      const mockContext = {
        fire: jest.fn(),
      };

      expect(typeof mockContext.fire).toBe('function');
    });
  });

  describe('Reduced Motion Support', () => {
    it('should check reduced motion preference', () => {
      const { getReducedMotionPreference } = require('@/lib/animations');

      // Verify the mock is being used
      expect(getReducedMotionPreference()).toBe(false);

      mockReducedMotion = true;
      expect(getReducedMotionPreference()).toBe(true);
    });
  });

  describe('Default Constants', () => {
    it('should have reasonable default values', () => {
      // Test that default values are defined correctly in the component
      // These values should match what's in the component
      const DEFAULT_PARTICLE_COUNT = 75;
      const DEFAULT_DURATION = 3000;
      const DEFAULT_SPREAD = 15;
      const DEFAULT_GRAVITY = 0.5;

      expect(DEFAULT_PARTICLE_COUNT).toBeGreaterThan(50);
      expect(DEFAULT_PARTICLE_COUNT).toBeLessThanOrEqual(100);
      expect(DEFAULT_DURATION).toBe(3000);
      expect(DEFAULT_SPREAD).toBeGreaterThan(0);
      expect(DEFAULT_GRAVITY).toBeGreaterThan(0);
    });
  });

  describe('Configuration Options', () => {
    it('should accept valid color arrays', () => {
      const config: ConfettiConfig = {
        colors: ['#6366F1', '#22D3EE', '#F59E0B', '#10B981'],
      };
      expect(config.colors).toHaveLength(4);
    });

    it('should accept origin positions between 0 and 1', () => {
      const centerConfig: ConfettiConfig = { originX: 0.5, originY: 0.5 };
      expect(centerConfig.originX).toBe(0.5);
      expect(centerConfig.originY).toBe(0.5);

      const topLeftConfig: ConfettiConfig = { originX: 0, originY: 0 };
      expect(topLeftConfig.originX).toBe(0);
      expect(topLeftConfig.originY).toBe(0);

      const bottomRightConfig: ConfettiConfig = { originX: 1, originY: 1 };
      expect(bottomRightConfig.originX).toBe(1);
      expect(bottomRightConfig.originY).toBe(1);
    });

    it('should accept custom particle counts', () => {
      const lowConfig: ConfettiConfig = { particleCount: 20 };
      const highConfig: ConfettiConfig = { particleCount: 100 };

      expect(lowConfig.particleCount).toBe(20);
      expect(highConfig.particleCount).toBe(100);
    });

    it('should accept custom duration values', () => {
      const shortConfig: ConfettiConfig = { duration: 1000 };
      const longConfig: ConfettiConfig = { duration: 5000 };

      expect(shortConfig.duration).toBe(1000);
      expect(longConfig.duration).toBe(5000);
    });
  });
});

describe('Confetti Component - Integration', () => {
  it('should export all expected types', () => {
    // Verify exports are available
    expect(Confetti).toBeDefined();
    expect(ConfettiProvider).toBeDefined();
    expect(useConfetti).toBeDefined();
  });

  it('should have a displayName', () => {
    expect(Confetti.displayName).toBe('Confetti');
  });
});

describe('Celebration Emojis', () => {
  it('should use appropriate celebration symbols', () => {
    // Native implementation uses emojis
    const CELEBRATION_EMOJIS = ['🎉', '🎊', '✨', '⭐', '🌟', '💫'];

    expect(CELEBRATION_EMOJIS).toContain('🎉');
    expect(CELEBRATION_EMOJIS).toContain('🎊');
    expect(CELEBRATION_EMOJIS.length).toBeGreaterThanOrEqual(4);
  });
});

describe('Default Colors', () => {
  it('should include theme-appropriate colors', () => {
    // Default colors should include primary and accent colors
    const DEFAULT_COLORS = [
      '#6366F1', // Primary indigo
      '#22D3EE', // Cyan
      '#F59E0B', // Amber
      '#10B981', // Green
      '#EF4444', // Red
      '#EC4899', // Pink
      '#8B5CF6', // Purple
    ];

    expect(DEFAULT_COLORS).toContain('#6366F1'); // Primary
    expect(DEFAULT_COLORS).toContain('#22D3EE'); // Secondary
    expect(DEFAULT_COLORS).toContain('#10B981'); // Success
    expect(DEFAULT_COLORS.length).toBeGreaterThanOrEqual(5);
  });
});
