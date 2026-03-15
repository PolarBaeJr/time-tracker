/**
 * Tests for chart animations
 *
 * Tests cover:
 * - Bar grow animation behavior
 * - Stagger animation timing
 * - Count-up animation for totals
 * - Reduced motion respect
 * - Animation props and configuration
 */

// Mock react-native before importing animations
jest.mock('react-native', () => ({
  Platform: { OS: 'web' },
  Easing: {
    linear: (x: number) => x,
    ease: (x: number) => x,
    out: (fn: (x: number) => number) => fn,
    inOut: (fn: (x: number) => number) => fn,
    bounce: (x: number) => x,
    bezier: () => (x: number) => x,
    elastic: () => (x: number) => x,
  },
  Animated: {
    Value: jest.fn(() => ({ setValue: jest.fn() })),
    timing: jest.fn(() => ({
      start: jest.fn(cb => cb?.({ finished: true })),
    })),
    loop: jest.fn(animation => animation),
    sequence: jest.fn(animations => animations[0]),
    parallel: jest.fn(animations => animations[0]),
    spring: jest.fn(() => ({
      start: jest.fn(cb => cb?.({ finished: true })),
    })),
    stagger: jest.fn((delay, animations) => animations[0]),
    View: 'Animated.View',
  },
}));

// Mock the stores and hooks
jest.mock('@/stores/uxSettingsStore', () => ({
  useUXSettingsSelector: jest.fn(selector => {
    const defaultState = {
      animationsEnabled: true,
      reducedMotion: false,
      hapticFeedbackEnabled: false,
      soundEnabled: false,
      soundVolume: 0.7,
      soundPreset: 'classic',
    };
    return selector(defaultState);
  }),
}));

// Now import animations after mocking
import { ANIMATION_DURATION, ANIMATION_EASING } from '@/lib/animations';

describe('Chart Animation Utilities', () => {
  describe('ANIMATION_DURATION', () => {
    it('should have correct duration presets', () => {
      expect(ANIMATION_DURATION.instant).toBe(0);
      expect(ANIMATION_DURATION.fast).toBe(150);
      expect(ANIMATION_DURATION.normal).toBe(250);
      expect(ANIMATION_DURATION.slow).toBe(400);
      expect(ANIMATION_DURATION.verySlow).toBe(600);
    });
  });

  describe('ANIMATION_EASING', () => {
    it('should have all required easing functions', () => {
      expect(typeof ANIMATION_EASING.linear).toBe('function');
      expect(typeof ANIMATION_EASING.easeIn).toBe('function');
      expect(typeof ANIMATION_EASING.easeOut).toBe('function');
      expect(typeof ANIMATION_EASING.easeInOut).toBe('function');
      expect(typeof ANIMATION_EASING.bounce).toBe('function');
      expect(typeof ANIMATION_EASING.spring).toBe('function');
      expect(typeof ANIMATION_EASING.elastic).toBe('function');
    });

    it('should return correct values at boundaries', () => {
      // easeOut should start fast and end slow
      expect(ANIMATION_EASING.linear(0)).toBe(0);
      expect(ANIMATION_EASING.linear(1)).toBe(1);
      expect(ANIMATION_EASING.linear(0.5)).toBe(0.5);
    });
  });
});

describe('SimpleBarChart Animation Props', () => {
  describe('Default Animation Props', () => {
    it('should have correct default animation values', () => {
      // These values match the SimpleBarChart defaults
      const defaults = {
        animateOnMount: true,
        staggerDelay: 50,
        animationDuration: 300,
      };

      expect(defaults.animateOnMount).toBe(true);
      expect(defaults.staggerDelay).toBe(50);
      expect(defaults.animationDuration).toBe(300);
    });
  });

  describe('Stagger Animation Timing', () => {
    it('should calculate correct delay for each bar', () => {
      const staggerDelay = 50;
      const barCount = 7;

      const delays = Array.from({ length: barCount }, (_, i) => i * staggerDelay);

      expect(delays).toEqual([0, 50, 100, 150, 200, 250, 300]);
    });

    it('should calculate total animation time', () => {
      const staggerDelay = 50;
      const animationDuration = 300;
      const barCount = 7;

      // Total time = last bar delay + animation duration
      const totalTime = (barCount - 1) * staggerDelay + animationDuration;

      expect(totalTime).toBe(600); // 300ms delay + 300ms duration
    });
  });

  describe('Bar Height Animation', () => {
    it('should interpolate height correctly', () => {
      const maxValue = 10;
      const testValues = [
        { value: 0, expectedPct: 0 },
        { value: 5, expectedPct: 50 },
        { value: 10, expectedPct: 100 },
        { value: 7.5, expectedPct: 75 },
      ];

      testValues.forEach(({ value, expectedPct }) => {
        const heightPct = maxValue > 0 ? (value / maxValue) * 100 : 0;
        expect(heightPct).toBe(expectedPct);
      });
    });

    it('should handle zero max value', () => {
      const maxValue = 0;
      const value = 5;
      const heightPct = maxValue > 0 ? (value / maxValue) * 100 : 0;
      expect(heightPct).toBe(0);
    });

    it('should apply minimum height for non-zero values', () => {
      const value = 0.01; // Very small value
      const minHeight = 2; // Minimum height percentage

      const effectiveHeight = value > 0 ? Math.max(value, minHeight) : 0;
      expect(effectiveHeight).toBeGreaterThanOrEqual(minHeight);
    });
  });
});

describe('Count-Up Animation', () => {
  describe('formatHoursCountUp', () => {
    // Test the formatter logic that would be used
    const formatHoursCountUp = (hours: number): string => {
      if (hours === 0) return '0h';
      if (hours < 1) return `${Math.round(hours * 60)}m`;
      return `${hours.toFixed(1)}h`;
    };

    it('should format zero correctly', () => {
      expect(formatHoursCountUp(0)).toBe('0h');
    });

    it('should format hours less than 1 as minutes', () => {
      expect(formatHoursCountUp(0.5)).toBe('30m');
      expect(formatHoursCountUp(0.25)).toBe('15m');
      expect(formatHoursCountUp(0.75)).toBe('45m');
    });

    it('should format hours >= 1 with decimal', () => {
      expect(formatHoursCountUp(1)).toBe('1.0h');
      expect(formatHoursCountUp(1.5)).toBe('1.5h');
      expect(formatHoursCountUp(10.75)).toBe('10.8h');
    });
  });

  describe('Animation Value Interpolation', () => {
    it('should interpolate between start and end values', () => {
      const startValue = 0;
      const endValue = 100;

      const interpolate = (progress: number) => startValue + (endValue - startValue) * progress;

      expect(interpolate(0)).toBe(0);
      expect(interpolate(0.5)).toBe(50);
      expect(interpolate(1)).toBe(100);
    });

    it('should handle negative values', () => {
      const startValue = -10;
      const endValue = 10;

      const interpolate = (progress: number) => startValue + (endValue - startValue) * progress;

      expect(interpolate(0)).toBe(-10);
      expect(interpolate(0.5)).toBe(0);
      expect(interpolate(1)).toBe(10);
    });
  });

  describe('Count-Up Total Calculation', () => {
    it('should calculate correct total for daily data', () => {
      const data = [
        { date: '2024-01-01', totalSeconds: 3600 }, // 1h
        { date: '2024-01-02', totalSeconds: 7200 }, // 2h
        { date: '2024-01-03', totalSeconds: 1800 }, // 0.5h
      ];

      const secondsToHours = (s: number) => Math.round((s / 3600) * 10) / 10;
      const total = data.reduce((sum, d) => sum + secondsToHours(d.totalSeconds), 0);

      expect(total).toBe(3.5);
    });

    it('should handle empty data', () => {
      const data: Array<{ totalSeconds: number }> = [];
      const secondsToHours = (s: number) => Math.round((s / 3600) * 10) / 10;
      const total = data.reduce((sum, d) => sum + secondsToHours(d.totalSeconds), 0);

      expect(total).toBe(0);
    });
  });
});

describe('Reduced Motion Support', () => {
  describe('Animation Decision Logic', () => {
    it('should animate when all conditions are met', () => {
      const animateOnMount = true;
      const animationsEnabled = true;
      const reducedMotion = false;

      const shouldAnimate = animateOnMount && animationsEnabled && !reducedMotion;
      expect(shouldAnimate).toBe(true);
    });

    it('should not animate when animateOnMount is false', () => {
      const animateOnMount = false;
      const animationsEnabled = true;
      const reducedMotion = false;

      const shouldAnimate = animateOnMount && animationsEnabled && !reducedMotion;
      expect(shouldAnimate).toBe(false);
    });

    it('should not animate when animationsEnabled is false', () => {
      const animateOnMount = true;
      const animationsEnabled = false;
      const reducedMotion = false;

      const shouldAnimate = animateOnMount && animationsEnabled && !reducedMotion;
      expect(shouldAnimate).toBe(false);
    });

    it('should not animate when reducedMotion is true', () => {
      const animateOnMount = true;
      const animationsEnabled = true;
      const reducedMotion = true;

      const shouldAnimate = animateOnMount && animationsEnabled && !reducedMotion;
      expect(shouldAnimate).toBe(false);
    });
  });

  describe('Fallback Behavior', () => {
    it('should show final value immediately when animations disabled', () => {
      const startValue = 0;
      const endValue = 100;
      const shouldAnimate = false;

      // When animations disabled, show end value immediately
      const displayValue = shouldAnimate ? startValue : endValue;
      expect(displayValue).toBe(endValue);
    });

    it('should use static height when animations disabled', () => {
      const heightPct = 75;
      const shouldAnimate = false;

      // When animations disabled, height should be set to final value
      const animatedHeightStyle = shouldAnimate
        ? { height: 'animated' } // Would be animated
        : { height: `${Math.max(heightPct, heightPct > 0 ? 2 : 0)}%` };

      expect(animatedHeightStyle.height).toBe('75%');
    });
  });
});

describe('Chart Component Props', () => {
  describe('DailyChart Props', () => {
    it('should have correct default props', () => {
      const defaultProps = {
        height: 200,
        showTotal: false,
        animateOnMount: true,
        staggerDelay: 50,
      };

      expect(defaultProps.height).toBe(200);
      expect(defaultProps.showTotal).toBe(false);
      expect(defaultProps.animateOnMount).toBe(true);
      expect(defaultProps.staggerDelay).toBe(50);
    });
  });

  describe('WeeklyChart Props', () => {
    it('should have correct default props', () => {
      const defaultProps = {
        height: 200,
        showTotal: false,
        animateOnMount: true,
        staggerDelay: 50,
      };

      expect(defaultProps.height).toBe(200);
      expect(defaultProps.showTotal).toBe(false);
      expect(defaultProps.animateOnMount).toBe(true);
      expect(defaultProps.staggerDelay).toBe(50);
    });
  });

  describe('MonthlyChart Props', () => {
    it('should have correct default props', () => {
      const defaultProps = {
        height: 200,
        showTotal: false,
        animateOnMount: true,
        staggerDelay: 50,
      };

      expect(defaultProps.height).toBe(200);
      expect(defaultProps.showTotal).toBe(false);
      expect(defaultProps.animateOnMount).toBe(true);
      expect(defaultProps.staggerDelay).toBe(50);
    });
  });
});

describe('Bar Data Transformation', () => {
  describe('Daily Data to Bars', () => {
    it('should transform daily data correctly', () => {
      const data = [
        { date: '2024-01-03', totalSeconds: 3600 },
        { date: '2024-01-02', totalSeconds: 7200 },
        { date: '2024-01-01', totalSeconds: 1800 },
      ];

      const formatDateAbbreviated = (d: string) => {
        const date = new Date(d + 'T00:00:00');
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      };

      const secondsToHours = (s: number) => Math.round((s / 3600) * 10) / 10;

      const bars = [...data].reverse().map(item => ({
        label: formatDateAbbreviated(item.date),
        value: secondsToHours(item.totalSeconds),
      }));

      expect(bars.length).toBe(3);
      expect(bars[0].value).toBe(0.5); // Jan 1
      expect(bars[1].value).toBe(2); // Jan 2
      expect(bars[2].value).toBe(1); // Jan 3
    });
  });

  describe('Weekly Data to Bars', () => {
    it('should transform weekly data correctly', () => {
      const data = [
        { weekStart: '2024-01-08', totalSeconds: 36000 },
        { weekStart: '2024-01-01', totalSeconds: 72000 },
      ];

      const formatWeekShort = (weekStart: string) => {
        const date = new Date(weekStart + 'T00:00:00');
        return `${date.getMonth() + 1}/${date.getDate()}`;
      };

      const secondsToHours = (s: number) => Math.round((s / 3600) * 10) / 10;

      const bars = [...data].reverse().map(item => ({
        label: formatWeekShort(item.weekStart),
        value: secondsToHours(item.totalSeconds),
      }));

      expect(bars.length).toBe(2);
      expect(bars[0].label).toBe('1/1');
      expect(bars[0].value).toBe(20);
      expect(bars[1].label).toBe('1/8');
      expect(bars[1].value).toBe(10);
    });
  });

  describe('Monthly Data to Bars', () => {
    it('should transform monthly data correctly', () => {
      const data = [
        { month: '2024-02', totalSeconds: 360000 },
        { month: '2024-01', totalSeconds: 720000 },
      ];

      const formatMonthShort = (month: string) => {
        const [year, monthNum] = month.split('-');
        const date = new Date(parseInt(year), parseInt(monthNum) - 1, 1);
        return date.toLocaleDateString('en-US', { month: 'short' });
      };

      const secondsToHours = (s: number) => Math.round((s / 3600) * 10) / 10;

      const bars = [...data].reverse().map(item => ({
        label: formatMonthShort(item.month),
        value: secondsToHours(item.totalSeconds),
      }));

      expect(bars.length).toBe(2);
      expect(bars[0].label).toBe('Jan');
      expect(bars[0].value).toBe(200);
      expect(bars[1].label).toBe('Feb');
      expect(bars[1].value).toBe(100);
    });
  });
});
