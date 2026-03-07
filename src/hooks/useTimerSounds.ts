import { useCallback } from 'react';
import { Platform } from 'react-native';

import { useTimerSettings } from '@/stores';

type SoundEvent = 'start' | 'stop' | 'phase-change' | 'countdown-complete';

function playTone(
  ctx: AudioContext,
  frequency: number,
  startTime: number,
  duration: number,
  volume: number
): void {
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = 'sine';
  oscillator.frequency.value = frequency;
  gain.gain.value = volume;
  gain.gain.setValueAtTime(volume, startTime);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.start(startTime);
  oscillator.stop(startTime + duration);
}

function playSoundEffect(event: SoundEvent, volume: number): void {
  const ctx = new AudioContext();
  const now = ctx.currentTime;

  switch (event) {
    case 'start':
      // Ascending two-tone beep
      playTone(ctx, 440, now, 0.15, volume);
      playTone(ctx, 660, now + 0.15, 0.15, volume);
      break;

    case 'stop':
      // Descending two-tone beep
      playTone(ctx, 660, now, 0.15, volume);
      playTone(ctx, 440, now + 0.15, 0.15, volume);
      break;

    case 'phase-change': {
      // Three quick beeps
      playTone(ctx, 880, now, 0.1, volume);
      playTone(ctx, 880, now + 0.15, 0.1, volume);
      playTone(ctx, 880, now + 0.3, 0.1, volume);
      break;
    }

    case 'countdown-complete': {
      // Celebratory ascending sweep
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(440, now);
      oscillator.frequency.exponentialRampToValueAtTime(880, now + 0.4);
      gain.gain.setValueAtTime(volume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start(now);
      oscillator.stop(now + 0.5);
      break;
    }
  }
}

interface UseTimerSoundsResult {
  playSound: (event: SoundEvent) => void;
}

export function useTimerSounds(): UseTimerSoundsResult {
  const { soundEnabled, soundVolume } = useTimerSettings();

  const playSound = useCallback(
    (event: SoundEvent) => {
      if (Platform.OS !== 'web') return;
      if (!soundEnabled) return;

      try {
        playSoundEffect(event, soundVolume);
      } catch {
        // Silently ignore audio errors (e.g. user hasn't interacted with page yet)
      }
    },
    [soundEnabled, soundVolume]
  );

  return { playSound };
}

export type { SoundEvent };
