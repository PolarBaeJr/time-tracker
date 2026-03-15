/**
 * Confetti Component
 *
 * Renders a celebration confetti animation for achievements and celebrations.
 *
 * Features:
 * - Canvas-based particle system on web
 * - Simpler emoji burst on native
 * - Physics-based falling with gravity
 * - Auto-cleanup after animation completes
 * - Imperative API via context and ref
 * - Respects reduced motion settings
 */

import * as React from 'react';
import { useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Animated, Dimensions, Platform, StyleSheet, View } from 'react-native';

import { getReducedMotionPreference } from '@/lib/animations';
import { useTheme } from '@/theme';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Confetti particle configuration
 */
export interface ConfettiConfig {
  /** Number of particles to generate (default: 75) */
  particleCount?: number;
  /** Duration in ms before auto-cleanup (default: 3000) */
  duration?: number;
  /** Colors to use for particles (defaults to theme accent colors) */
  colors?: string[];
  /** Starting position as percentage of screen width (0-1, default: 0.5 = center) */
  originX?: number;
  /** Starting position as percentage of screen height (0-1, default: 0.5 = center) */
  originY?: number;
  /** Initial velocity spread (default: 15) */
  spread?: number;
  /** Gravity effect (default: 0.5) */
  gravity?: number;
}

/**
 * Imperative handle for Confetti component
 */
export interface ConfettiRef {
  /** Trigger the confetti animation */
  fire: (config?: ConfettiConfig) => void;
  /** Stop and clean up the animation */
  stop: () => void;
}

/**
 * Props for the Confetti component
 */
export interface ConfettiProps {
  /** Called when animation completes */
  onComplete?: () => void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_PARTICLE_COUNT = 75;
const DEFAULT_DURATION = 3000;
const DEFAULT_SPREAD = 15;
const DEFAULT_GRAVITY = 0.5;

/** Default celebration colors when theme colors not provided */
const DEFAULT_COLORS = [
  '#6366F1', // Primary indigo
  '#22D3EE', // Cyan
  '#F59E0B', // Amber
  '#10B981', // Green
  '#EF4444', // Red
  '#EC4899', // Pink
  '#8B5CF6', // Purple
];

/** Emoji options for native fallback */
const CELEBRATION_EMOJIS = ['🎉', '🎊', '✨', '⭐', '🌟', '💫'];

// ============================================================================
// PARTICLE SYSTEM (WEB)
// ============================================================================

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  rotation: number;
  rotationSpeed: number;
  shape: 'square' | 'circle' | 'triangle';
  opacity: number;
}

function createParticle(
  originX: number,
  originY: number,
  colors: string[],
  spread: number
): Particle {
  const shapes = ['square', 'circle', 'triangle'] as const;
  const angle = Math.random() * Math.PI * 2;
  const velocity = 5 + Math.random() * spread;

  return {
    x: originX,
    y: originY,
    vx: Math.cos(angle) * velocity,
    vy: Math.sin(angle) * velocity - 5, // Initial upward velocity
    color: colors[Math.floor(Math.random() * colors.length)],
    size: 8 + Math.random() * 8,
    rotation: Math.random() * 360,
    rotationSpeed: -5 + Math.random() * 10,
    shape: shapes[Math.floor(Math.random() * shapes.length)],
    opacity: 1,
  };
}

function updateParticle(particle: Particle, gravity: number, elapsed: number): void {
  particle.x += particle.vx;
  particle.y += particle.vy;
  particle.vy += gravity; // Apply gravity
  particle.rotation += particle.rotationSpeed;
  particle.vx *= 0.99; // Air resistance

  // Fade out as particle falls
  if (elapsed > 2000) {
    particle.opacity = Math.max(0, 1 - (elapsed - 2000) / 1000);
  }
}

function drawParticle(ctx: CanvasRenderingContext2D, particle: Particle): void {
  ctx.save();
  ctx.translate(particle.x, particle.y);
  ctx.rotate((particle.rotation * Math.PI) / 180);
  ctx.globalAlpha = particle.opacity;
  ctx.fillStyle = particle.color;

  const halfSize = particle.size / 2;

  switch (particle.shape) {
    case 'square':
      ctx.fillRect(-halfSize, -halfSize, particle.size, particle.size);
      break;
    case 'circle':
      ctx.beginPath();
      ctx.arc(0, 0, halfSize, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'triangle':
      ctx.beginPath();
      ctx.moveTo(0, -halfSize);
      ctx.lineTo(-halfSize, halfSize);
      ctx.lineTo(halfSize, halfSize);
      ctx.closePath();
      ctx.fill();
      break;
  }

  ctx.restore();
}

// ============================================================================
// WEB CANVAS COMPONENT
// ============================================================================

interface WebConfettiState {
  isActive: boolean;
  config: Required<ConfettiConfig>;
}

function WebConfetti(
  props: ConfettiProps,
  ref: React.ForwardedRef<ConfettiRef>
): React.ReactElement | null {
  const { onComplete } = props;
  const { colors: themeColors } = useTheme();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const startTimeRef = useRef<number>(0);

  const [state, setState] = useState<WebConfettiState>({
    isActive: false,
    config: {
      particleCount: DEFAULT_PARTICLE_COUNT,
      duration: DEFAULT_DURATION,
      colors: DEFAULT_COLORS,
      originX: 0.5,
      originY: 0.5,
      spread: DEFAULT_SPREAD,
      gravity: DEFAULT_GRAVITY,
    },
  });

  const stop = useCallback(() => {
    if (animationRef.current !== null) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    particlesRef.current = [];
    setState(prev => ({ ...prev, isActive: false }));
  }, []);

  const fire = useCallback(
    (config?: ConfettiConfig) => {
      // Check for reduced motion
      if (getReducedMotionPreference()) {
        onComplete?.();
        return;
      }

      const { width, height } = Dimensions.get('window');
      const mergedConfig: Required<ConfettiConfig> = {
        particleCount: config?.particleCount ?? DEFAULT_PARTICLE_COUNT,
        duration: config?.duration ?? DEFAULT_DURATION,
        colors: config?.colors ?? [
          themeColors.primary,
          themeColors.secondary,
          themeColors.success,
          themeColors.warning,
          '#EC4899', // Pink
          '#8B5CF6', // Purple
        ],
        originX: config?.originX ?? 0.5,
        originY: config?.originY ?? 0.5,
        spread: config?.spread ?? DEFAULT_SPREAD,
        gravity: config?.gravity ?? DEFAULT_GRAVITY,
      };

      const originX = width * mergedConfig.originX;
      const originY = height * mergedConfig.originY;

      // Create particles
      particlesRef.current = Array.from({ length: mergedConfig.particleCount }, () =>
        createParticle(originX, originY, mergedConfig.colors, mergedConfig.spread)
      );

      startTimeRef.current = performance.now();
      setState({ isActive: true, config: mergedConfig });
    },
    [themeColors, onComplete]
  );

  // Animation loop
  useEffect(() => {
    if (!state.isActive || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = Dimensions.get('window');
    canvas.width = width;
    canvas.height = height;

    const animate = (timestamp: number) => {
      const elapsed = timestamp - startTimeRef.current;

      // Check if animation should end
      if (elapsed > state.config.duration) {
        stop();
        onComplete?.();
        return;
      }

      // Clear canvas
      ctx.clearRect(0, 0, width, height);

      // Update and draw particles
      for (const particle of particlesRef.current) {
        updateParticle(particle, state.config.gravity, elapsed);
        drawParticle(ctx, particle);
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [state.isActive, state.config, stop, onComplete]);

  // Expose imperative handle
  useImperativeHandle(ref, () => ({ fire, stop }), [fire, stop]);

  if (!state.isActive) {
    return null;
  }

  return (
    <View style={styles.container} pointerEvents="none">
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
        }}
      />
    </View>
  );
}

// ============================================================================
// NATIVE EMOJI BURST COMPONENT
// ============================================================================

interface EmojiParticle {
  emoji: string;
  x: Animated.Value;
  y: Animated.Value;
  opacity: Animated.Value;
  rotation: Animated.Value;
  scale: Animated.Value;
  targetX: number;
  targetY: number;
}

function NativeConfetti(
  props: ConfettiProps,
  ref: React.ForwardedRef<ConfettiRef>
): React.ReactElement | null {
  const { onComplete } = props;
  const [particles, setParticles] = useState<EmojiParticle[]>([]);
  const [isActive, setIsActive] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stop = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setParticles([]);
    setIsActive(false);
  }, []);

  const fire = useCallback(
    (config?: ConfettiConfig) => {
      // Check for reduced motion
      if (getReducedMotionPreference()) {
        onComplete?.();
        return;
      }

      const { width, height } = Dimensions.get('window');
      const particleCount = Math.min(config?.particleCount ?? 20, 30); // Limit for performance
      const duration = config?.duration ?? DEFAULT_DURATION;
      const originX = (config?.originX ?? 0.5) * width;
      const originY = (config?.originY ?? 0.5) * height;
      const _spread = config?.spread ?? DEFAULT_SPREAD;

      // Create emoji particles
      const newParticles: EmojiParticle[] = Array.from({ length: particleCount }, () => {
        const angle = Math.random() * Math.PI * 2;
        const distance = 100 + Math.random() * 200;
        const targetX = originX + Math.cos(angle) * distance;
        const targetY = originY + Math.sin(angle) * distance + 100; // Fall down

        return {
          emoji: CELEBRATION_EMOJIS[Math.floor(Math.random() * CELEBRATION_EMOJIS.length)],
          x: new Animated.Value(originX),
          y: new Animated.Value(originY),
          opacity: new Animated.Value(1),
          rotation: new Animated.Value(0),
          scale: new Animated.Value(0),
          targetX,
          targetY,
        };
      });

      setParticles(newParticles);
      setIsActive(true);

      // Animate each particle
      const animations = newParticles.map((particle, _index) => {
        const delay = Math.random() * 100;

        return Animated.parallel([
          // Scale in
          Animated.sequence([
            Animated.delay(delay),
            Animated.spring(particle.scale, {
              toValue: 1,
              friction: 4,
              tension: 100,
              useNativeDriver: true,
            }),
          ]),
          // Move to target
          Animated.sequence([
            Animated.delay(delay),
            Animated.timing(particle.x, {
              toValue: particle.targetX,
              duration: duration * 0.8,
              useNativeDriver: true,
            }),
          ]),
          Animated.sequence([
            Animated.delay(delay),
            Animated.timing(particle.y, {
              toValue: particle.targetY,
              duration: duration * 0.8,
              useNativeDriver: true,
            }),
          ]),
          // Rotate
          Animated.sequence([
            Animated.delay(delay),
            Animated.timing(particle.rotation, {
              toValue: 360 * (Math.random() > 0.5 ? 1 : -1),
              duration: duration * 0.8,
              useNativeDriver: true,
            }),
          ]),
          // Fade out
          Animated.sequence([
            Animated.delay(duration * 0.6),
            Animated.timing(particle.opacity, {
              toValue: 0,
              duration: duration * 0.4,
              useNativeDriver: true,
            }),
          ]),
        ]);
      });

      Animated.parallel(animations).start();

      // Auto-cleanup
      timeoutRef.current = setTimeout(() => {
        stop();
        onComplete?.();
      }, duration);
    },
    [onComplete, stop]
  );

  // Expose imperative handle
  useImperativeHandle(ref, () => ({ fire, stop }), [fire, stop]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  if (!isActive || particles.length === 0) {
    return null;
  }

  return (
    <View style={styles.container} pointerEvents="none">
      {particles.map((particle, index) => (
        <Animated.Text
          key={index}
          style={[
            styles.emoji,
            {
              opacity: particle.opacity,
              transform: [
                { translateX: particle.x },
                { translateY: particle.y },
                { scale: particle.scale },
                {
                  rotate: particle.rotation.interpolate({
                    inputRange: [0, 360],
                    outputRange: ['0deg', '360deg'],
                  }),
                },
              ],
            },
          ]}
        >
          {particle.emoji}
        </Animated.Text>
      ))}
    </View>
  );
}

// ============================================================================
// EXPORTED COMPONENT
// ============================================================================

/**
 * Confetti Component
 *
 * Renders a celebration confetti animation.
 * Uses Canvas API on web for smooth particle physics.
 * Uses emoji burst animation on native for simplicity.
 *
 * @example
 * ```tsx
 * const confettiRef = useRef<ConfettiRef>(null);
 *
 * // Trigger confetti
 * confettiRef.current?.fire();
 *
 * // With custom config
 * confettiRef.current?.fire({
 *   particleCount: 100,
 *   duration: 4000,
 *   colors: ['#ff0000', '#00ff00', '#0000ff'],
 * });
 *
 * return <Confetti ref={confettiRef} onComplete={() => console.log('Done!')} />;
 * ```
 */
export const Confetti = React.forwardRef<ConfettiRef, ConfettiProps>(
  Platform.OS === 'web' ? WebConfetti : NativeConfetti
);

Confetti.displayName = 'Confetti';

// ============================================================================
// CONFETTI CONTEXT
// ============================================================================

interface ConfettiContextValue {
  fire: (config?: ConfettiConfig) => void;
}

const ConfettiContext = React.createContext<ConfettiContextValue | null>(null);

/**
 * Confetti Provider
 *
 * Wrap your app with this provider to enable confetti from anywhere.
 *
 * @example
 * ```tsx
 * <ConfettiProvider>
 *   <App />
 * </ConfettiProvider>
 *
 * // In any component
 * const { fire } = useConfetti();
 * fire(); // Trigger confetti
 * ```
 */
export function ConfettiProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const confettiRef = useRef<ConfettiRef>(null);

  const fire = useCallback((config?: ConfettiConfig) => {
    confettiRef.current?.fire(config);
  }, []);

  const value = React.useMemo(() => ({ fire }), [fire]);

  return (
    <ConfettiContext.Provider value={value}>
      {children}
      <Confetti ref={confettiRef} />
    </ConfettiContext.Provider>
  );
}

/**
 * Hook to trigger confetti from any component
 *
 * Must be used within a ConfettiProvider.
 *
 * @returns Object with fire() method to trigger confetti
 * @throws Error if used outside ConfettiProvider
 */
export function useConfetti(): ConfettiContextValue {
  const context = React.useContext(ConfettiContext);
  if (!context) {
    throw new Error('useConfetti must be used within a ConfettiProvider');
  }
  return context;
}

/**
 * Safe version of useConfetti that returns null if not within a ConfettiProvider
 *
 * Use this when confetti is optional and you don't want to require ConfettiProvider.
 *
 * @returns Object with fire() method to trigger confetti, or null if not available
 */
export function useConfettiSafe(): ConfettiContextValue | null {
  return React.useContext(ConfettiContext);
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    elevation: 9999,
  },
  emoji: {
    position: 'absolute',
    fontSize: 24,
  },
});

export default Confetti;
