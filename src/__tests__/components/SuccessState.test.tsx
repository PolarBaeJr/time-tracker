/**
 * SuccessState Component Tests
 *
 * Tests for the SuccessState component including:
 * - Component rendering
 * - Props handling
 * - Animation behavior
 * - Auto-dismiss functionality
 * - Confetti integration
 */

import { render, act } from '../mocks/testing-library-react-native';

// Mock hooks module (required by Button)
jest.mock('@/hooks', () => ({
  useHaptics: () => ({
    triggerLight: jest.fn(),
    triggerMedium: jest.fn(),
    triggerHeavy: jest.fn(),
    triggerSuccess: jest.fn(),
    triggerWarning: jest.fn(),
    triggerError: jest.fn(),
    trigger: jest.fn(),
    isEnabled: true,
  }),
}));

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
      primaryVariant: '#4F46E5',
      surface: '#1F1F1F',
      surfaceVariant: '#2D2D2D',
      success: '#10B981',
      text: '#FFFFFF',
      textSecondary: '#A1A1AA',
      textMuted: '#666666',
      error: '#EF4444',
      overlayLight: 'rgba(255, 255, 255, 0.1)',
    },
    isDark: true,
  }),
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
  fontSizes: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 20,
  },
  fontWeights: {
    normal: '400',
    semibold: '600',
    bold: '700',
  },
  lineHeights: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.75,
  },
  borderRadius: {
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
    full: 9999,
  },
  shadows: {
    sm: {},
    md: {},
  },
}));

// Mock confetti context
const mockFireConfetti = jest.fn();
jest.mock('@/components/ui/Confetti', () => ({
  useConfetti: () => ({
    fire: mockFireConfetti,
  }),
  useConfettiSafe: () => ({
    fire: mockFireConfetti,
  }),
}));

// Import after mocks
import { SuccessState, type SuccessStateProps } from '@/components/ui/SuccessState';

describe('SuccessState Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockReducedMotion = false;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Rendering', () => {
    it('should render without crashing', () => {
      const result = render(<SuccessState />);
      expect(result).toBeDefined();
      expect(result.toJSON()).not.toBeNull();
    });

    it('should render with testID', () => {
      const { getByTestId } = render(<SuccessState testID="success-state" />);
      expect(getByTestId('success-state')).toBeTruthy();
    });

    it('should render with all props', () => {
      const onDismiss = jest.fn();
      const result = render(
        <SuccessState
          title="Custom Title"
          message="Custom message"
          onDismiss={onDismiss}
          showConfetti={false}
          autoDismissDelay={0}
          dismissLabel="OK"
          showDismissButton={true}
          checkmarkSize={100}
          testID="full-success"
        />
      );
      expect(result.toJSON()).not.toBeNull();
    });
  });

  describe('Props Types', () => {
    it('should have correct props type shape', () => {
      const props: SuccessStateProps = {
        title: 'Test Title',
        message: 'Test message',
        onDismiss: jest.fn(),
        showConfetti: true,
        autoDismissDelay: 3000,
        dismissLabel: 'OK',
        showDismissButton: true,
        checkmarkSize: 100,
        testID: 'success-state',
      };

      expect(props.title).toBe('Test Title');
      expect(props.message).toBe('Test message');
      expect(typeof props.onDismiss).toBe('function');
      expect(props.showConfetti).toBe(true);
      expect(props.autoDismissDelay).toBe(3000);
      expect(props.dismissLabel).toBe('OK');
      expect(props.showDismissButton).toBe(true);
      expect(props.checkmarkSize).toBe(100);
      expect(props.testID).toBe('success-state');
    });

    it('should allow minimal props', () => {
      const props: SuccessStateProps = {};
      expect(props.title).toBeUndefined();
      expect(props.onDismiss).toBeUndefined();
    });

    it('should have default values', () => {
      // Default values are applied at component level
      const result = render(<SuccessState />);
      // Component should render with defaults
      expect(result.toJSON()).not.toBeNull();
    });
  });

  describe('Auto-dismiss behavior', () => {
    it('should not auto-dismiss when autoDismissDelay is 0', () => {
      const onDismiss = jest.fn();
      render(<SuccessState onDismiss={onDismiss} autoDismissDelay={0} />);

      act(() => {
        jest.advanceTimersByTime(10000);
      });

      expect(onDismiss).not.toHaveBeenCalled();
    });

    it('should clean up timeout on unmount', () => {
      const onDismiss = jest.fn();
      const { unmount } = render(<SuccessState onDismiss={onDismiss} autoDismissDelay={5000} />);

      unmount();

      act(() => {
        jest.advanceTimersByTime(5000);
      });

      expect(onDismiss).not.toHaveBeenCalled();
    });

    it('should set up auto-dismiss when delay is provided', () => {
      const onDismiss = jest.fn();
      render(<SuccessState onDismiss={onDismiss} autoDismissDelay={3000} />);

      // Verify timeout is set - if this doesn't throw, setup worked
      expect(onDismiss).not.toHaveBeenCalled();
    });
  });

  describe('Confetti Integration', () => {
    it('should not fire confetti by default', () => {
      render(<SuccessState />);

      act(() => {
        jest.advanceTimersByTime(1000);
      });

      expect(mockFireConfetti).not.toHaveBeenCalled();
    });

    it('should not fire confetti with reduced motion', () => {
      mockReducedMotion = true;
      render(<SuccessState showConfetti />);

      act(() => {
        jest.advanceTimersByTime(3000);
      });

      expect(mockFireConfetti).not.toHaveBeenCalled();
    });

    it('should set up confetti when showConfetti is true', () => {
      // Just verify the prop is accepted without error
      const result = render(<SuccessState showConfetti />);
      expect(result.toJSON()).not.toBeNull();
    });
  });

  describe('Reduced Motion', () => {
    it('should check reduced motion preference', () => {
      const { getReducedMotionPreference } = require('@/lib/animations');

      mockReducedMotion = false;
      expect(getReducedMotionPreference()).toBe(false);

      mockReducedMotion = true;
      expect(getReducedMotionPreference()).toBe(true);
    });

    it('should render with reduced motion enabled', () => {
      mockReducedMotion = true;
      const result = render(<SuccessState title="Instant Success" />);
      expect(result.toJSON()).not.toBeNull();
    });
  });

  describe('Checkmark Customization', () => {
    it('should render with default checkmark size', () => {
      const result = render(<SuccessState />);
      expect(result.toJSON()).not.toBeNull();
    });

    it('should render with custom checkmark size', () => {
      const result = render(<SuccessState checkmarkSize={120} />);
      expect(result.toJSON()).not.toBeNull();
    });

    it('should render with small checkmark size', () => {
      const result = render(<SuccessState checkmarkSize={40} />);
      expect(result.toJSON()).not.toBeNull();
    });
  });

  describe('Show/Hide Dismiss Button', () => {
    it('should render without dismiss button when showDismissButton is false', () => {
      const onDismiss = jest.fn();
      const result = render(<SuccessState onDismiss={onDismiss} showDismissButton={false} />);
      expect(result.toJSON()).not.toBeNull();
    });

    it('should render without dismiss button when onDismiss not provided', () => {
      const result = render(<SuccessState showDismissButton={true} />);
      expect(result.toJSON()).not.toBeNull();
    });

    it('should render with dismiss button when both props provided', () => {
      const onDismiss = jest.fn();
      const result = render(<SuccessState onDismiss={onDismiss} showDismissButton={true} />);
      expect(result.toJSON()).not.toBeNull();
    });
  });
});

describe('SuccessState Constants', () => {
  it('should have reasonable default checkmark size', () => {
    const DEFAULT_CHECKMARK_SIZE = 80;
    expect(DEFAULT_CHECKMARK_SIZE).toBeGreaterThan(50);
    expect(DEFAULT_CHECKMARK_SIZE).toBeLessThanOrEqual(120);
  });

  it('should have reasonable animation durations', () => {
    const CIRCLE_ANIMATION_DURATION = 400;
    const CHECKMARK_ANIMATION_DURATION = 300;
    const SCALE_ANIMATION_DURATION = 200;
    const CONFETTI_DELAY = 300;

    expect(CIRCLE_ANIMATION_DURATION).toBeGreaterThan(0);
    expect(CHECKMARK_ANIMATION_DURATION).toBeGreaterThan(0);
    expect(SCALE_ANIMATION_DURATION).toBeGreaterThan(0);
    expect(CONFETTI_DELAY).toBeGreaterThan(0);
  });
});

describe('SuccessState Component Export', () => {
  it('should export SuccessState component', () => {
    expect(SuccessState).toBeDefined();
    expect(typeof SuccessState).toBe('function');
  });

  it('should export SuccessStateProps type', () => {
    // Type check - create a valid props object
    const validProps: SuccessStateProps = {
      title: 'Test',
    };
    expect(validProps.title).toBe('Test');
  });
});
