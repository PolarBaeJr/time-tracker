/**
 * Timer Sounds Hook
 *
 * Provides audio feedback for timer events and other interactions.
 * Uses Web Audio API for sound synthesis (web platform only).
 * Respects user sound settings from UX Settings Store.
 *
 * @example
 * ```tsx
 * const { playSound, playTimerSound } = useSounds();
 *
 * // Play timer events
 * playTimerSound('start');
 * playTimerSound('countdown-complete');
 *
 * // Play other sounds
 * playSound('achievement_unlock');
 * playSound('notification_chime');
 * ```
 */
import { useCallback } from 'react';
import { Platform } from 'react-native';

import { useUXSettings } from '@/stores';
import {
  type SoundEventType,
  type SoundDefinition,
  type ToneDefinition,
  type FrequencySweep,
  type WaveType,
  getSoundDefinition,
} from '@/lib/sounds';

// Legacy type for backwards compatibility
type SoundEvent = 'start' | 'stop' | 'phase-change' | 'countdown-complete';

/**
 * Play a single tone using Web Audio API.
 */
function playTone(
  ctx: AudioContext,
  frequency: number,
  startTime: number,
  duration: number,
  volume: number,
  waveType: WaveType = 'sine'
): void {
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();

  oscillator.type = waveType;
  oscillator.frequency.value = frequency;

  // Set initial volume and ramp down to avoid clicks
  gain.gain.setValueAtTime(volume, startTime);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.start(startTime);
  oscillator.stop(startTime + duration);
}

/**
 * Play a frequency sweep using Web Audio API.
 */
function playSweep(
  ctx: AudioContext,
  startFrequency: number,
  endFrequency: number,
  startTime: number,
  duration: number,
  volume: number,
  waveType: WaveType = 'sine'
): void {
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();

  oscillator.type = waveType;
  oscillator.frequency.setValueAtTime(startFrequency, startTime);
  oscillator.frequency.exponentialRampToValueAtTime(endFrequency, startTime + duration);

  gain.gain.setValueAtTime(volume, startTime);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration + 0.1);

  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.start(startTime);
  oscillator.stop(startTime + duration + 0.1);
}

/**
 * Play a sound definition using Web Audio API.
 */
function playSoundDefinition(definition: SoundDefinition, baseVolume: number): void {
  const ctx = new AudioContext();
  const now = ctx.currentTime;

  // Play all tones
  if (definition.tones) {
    definition.tones.forEach((tone: ToneDefinition) => {
      const volume = baseVolume * (tone.volumeMultiplier ?? 1);
      playTone(
        ctx,
        tone.frequency,
        now + tone.startTime,
        tone.duration,
        volume,
        tone.waveType || 'sine'
      );
    });
  }

  // Play all sweeps
  if (definition.sweeps) {
    definition.sweeps.forEach((sweep: FrequencySweep) => {
      const volume = baseVolume * (sweep.volumeMultiplier ?? 1);
      playSweep(
        ctx,
        sweep.startFrequency,
        sweep.endFrequency,
        now + sweep.startTime,
        sweep.duration,
        volume,
        sweep.waveType || 'sine'
      );
    });
  }
}

/**
 * Result from the useSounds hook.
 */
export interface UseSoundsResult {
  /**
   * Play any sound event.
   * @param event - The sound event type to play
   */
  playSound: (event: SoundEventType) => void;

  /**
   * Play timer-specific sounds (legacy compatibility).
   * @param event - Timer sound event
   */
  playTimerSound: (event: SoundEvent) => void;

  /**
   * Check if sounds are enabled.
   */
  soundEnabled: boolean;

  /**
   * Current sound volume (0-1).
   */
  soundVolume: number;

  /**
   * Current sound preset.
   */
  soundPreset: string;
}

/**
 * Hook providing audio feedback functionality.
 *
 * Uses the UX Settings Store for sound preferences.
 * Only works on web platform (uses Web Audio API).
 *
 * @returns Object with playSound function and sound settings
 */
export function useSounds(): UseSoundsResult {
  const { soundEnabled, soundVolume, soundPreset } = useUXSettings();

  const playSound = useCallback(
    (event: SoundEventType) => {
      // Only play on web platform
      if (Platform.OS !== 'web') return;

      // Check if sounds are enabled
      if (!soundEnabled) return;

      try {
        const definition = getSoundDefinition(event, soundPreset);
        playSoundDefinition(definition, soundVolume);
      } catch {
        // Silently ignore audio errors (e.g. user hasn't interacted with page yet)
      }
    },
    [soundEnabled, soundVolume, soundPreset]
  );

  // Legacy compatibility - map old SoundEvent to new SoundEventType
  const playTimerSound = useCallback(
    (event: SoundEvent) => {
      playSound(event);
    },
    [playSound]
  );

  return {
    playSound,
    playTimerSound,
    soundEnabled,
    soundVolume,
    soundPreset,
  };
}

/**
 * Legacy hook for backwards compatibility.
 * @deprecated Use useSounds() instead
 */
export interface UseTimerSoundsResult {
  playSound: (event: SoundEvent) => void;
}

/**
 * Legacy hook for timer sounds.
 * @deprecated Use useSounds() instead
 */
export function useTimerSounds(): UseTimerSoundsResult {
  const { playTimerSound } = useSounds();

  return {
    playSound: playTimerSound,
  };
}

// Re-export SoundEvent type for backwards compatibility
export type { SoundEvent };
