/**
 * Sound System Definitions
 *
 * Defines sound frequencies, patterns, and presets for audio feedback.
 * Used by useTimerSounds and other audio hooks.
 *
 * Sound presets:
 * - classic: Original bold sounds with clear tones
 * - soft: Gentler sounds with rounded frequencies
 * - minimal: Subtle, unobtrusive audio feedback
 */

/**
 * Sound event types available in the app.
 */
export type SoundEventType =
  | 'start'
  | 'stop'
  | 'phase-change'
  | 'countdown-complete'
  | 'achievement_unlock'
  | 'notification_chime'
  | 'interaction_click'
  | 'error_buzz';

/**
 * Oscillator wave types for sound synthesis.
 */
export type WaveType = 'sine' | 'square' | 'sawtooth' | 'triangle';

/**
 * A single tone within a sound pattern.
 */
export interface ToneDefinition {
  /** Frequency in Hz */
  frequency: number;
  /** Duration in seconds */
  duration: number;
  /** Start time offset in seconds from sound start */
  startTime: number;
  /** Wave type for this tone */
  waveType?: WaveType;
  /** Volume multiplier (0-1), defaults to 1 */
  volumeMultiplier?: number;
}

/**
 * A frequency sweep for dynamic sounds.
 */
export interface FrequencySweep {
  /** Starting frequency in Hz */
  startFrequency: number;
  /** Ending frequency in Hz */
  endFrequency: number;
  /** Duration in seconds */
  duration: number;
  /** Start time offset in seconds */
  startTime: number;
  /** Wave type for sweep */
  waveType?: WaveType;
  /** Volume multiplier (0-1), defaults to 1 */
  volumeMultiplier?: number;
}

/**
 * Complete sound definition with tones and/or sweeps.
 */
export interface SoundDefinition {
  /** Name of the sound for debugging/logging */
  name: string;
  /** Array of individual tones */
  tones?: ToneDefinition[];
  /** Array of frequency sweeps */
  sweeps?: FrequencySweep[];
  /** Total duration of the sound in seconds */
  totalDuration: number;
}

/**
 * Sound preset with all sound definitions for each event type.
 */
export type SoundPresetDefinitions = Record<SoundEventType, SoundDefinition>;

// ========== CLASSIC PRESET ==========
// Bold, clear sounds with strong tones

const classicSounds: SoundPresetDefinitions = {
  start: {
    name: 'classic_start',
    tones: [
      { frequency: 440, duration: 0.15, startTime: 0 },
      { frequency: 660, duration: 0.15, startTime: 0.15 },
    ],
    totalDuration: 0.3,
  },

  stop: {
    name: 'classic_stop',
    tones: [
      { frequency: 660, duration: 0.15, startTime: 0 },
      { frequency: 440, duration: 0.15, startTime: 0.15 },
    ],
    totalDuration: 0.3,
  },

  'phase-change': {
    name: 'classic_phase_change',
    tones: [
      { frequency: 880, duration: 0.1, startTime: 0 },
      { frequency: 880, duration: 0.1, startTime: 0.15 },
      { frequency: 880, duration: 0.1, startTime: 0.3 },
    ],
    totalDuration: 0.4,
  },

  'countdown-complete': {
    name: 'classic_countdown_complete',
    sweeps: [
      {
        startFrequency: 440,
        endFrequency: 880,
        duration: 0.4,
        startTime: 0,
      },
    ],
    totalDuration: 0.5,
  },

  achievement_unlock: {
    name: 'classic_achievement_unlock',
    tones: [
      // Triumphant ascending chord (C-E-G-C)
      { frequency: 523.25, duration: 0.2, startTime: 0 }, // C5
      { frequency: 659.25, duration: 0.2, startTime: 0.1 }, // E5
      { frequency: 783.99, duration: 0.2, startTime: 0.2 }, // G5
      { frequency: 1046.5, duration: 0.3, startTime: 0.3 }, // C6
    ],
    totalDuration: 0.6,
  },

  notification_chime: {
    name: 'classic_notification_chime',
    tones: [
      // Soft bell-like chime (two notes)
      { frequency: 880, duration: 0.15, startTime: 0, waveType: 'sine' },
      { frequency: 1318.51, duration: 0.2, startTime: 0.1, waveType: 'sine' }, // E6
    ],
    totalDuration: 0.3,
  },

  interaction_click: {
    name: 'classic_interaction_click',
    tones: [
      // Short, subtle click
      { frequency: 1200, duration: 0.03, startTime: 0, volumeMultiplier: 0.5 },
    ],
    totalDuration: 0.03,
  },

  error_buzz: {
    name: 'classic_error_buzz',
    tones: [
      // Low buzz with slight dissonance
      { frequency: 150, duration: 0.15, startTime: 0, waveType: 'sawtooth', volumeMultiplier: 0.6 },
      { frequency: 155, duration: 0.15, startTime: 0, waveType: 'sawtooth', volumeMultiplier: 0.6 },
    ],
    totalDuration: 0.15,
  },
};

// ========== SOFT PRESET ==========
// Gentler sounds with rounded frequencies and longer fades

const softSounds: SoundPresetDefinitions = {
  start: {
    name: 'soft_start',
    tones: [
      { frequency: 392, duration: 0.2, startTime: 0 }, // G4
      { frequency: 523.25, duration: 0.2, startTime: 0.18 }, // C5
    ],
    totalDuration: 0.4,
  },

  stop: {
    name: 'soft_stop',
    tones: [
      { frequency: 523.25, duration: 0.2, startTime: 0 }, // C5
      { frequency: 392, duration: 0.25, startTime: 0.18 }, // G4
    ],
    totalDuration: 0.45,
  },

  'phase-change': {
    name: 'soft_phase_change',
    tones: [
      { frequency: 698.46, duration: 0.12, startTime: 0 }, // F5
      { frequency: 698.46, duration: 0.12, startTime: 0.2 },
    ],
    totalDuration: 0.35,
  },

  'countdown-complete': {
    name: 'soft_countdown_complete',
    sweeps: [
      {
        startFrequency: 392,
        endFrequency: 659.25,
        duration: 0.5,
        startTime: 0,
      },
    ],
    totalDuration: 0.6,
  },

  achievement_unlock: {
    name: 'soft_achievement_unlock',
    tones: [
      // Gentle ascending arpeggio
      { frequency: 440, duration: 0.25, startTime: 0, volumeMultiplier: 0.8 }, // A4
      { frequency: 554.37, duration: 0.25, startTime: 0.15, volumeMultiplier: 0.85 }, // C#5
      { frequency: 659.25, duration: 0.3, startTime: 0.3, volumeMultiplier: 0.9 }, // E5
    ],
    totalDuration: 0.6,
  },

  notification_chime: {
    name: 'soft_notification_chime',
    tones: [
      // Single gentle bell
      { frequency: 783.99, duration: 0.25, startTime: 0, waveType: 'sine', volumeMultiplier: 0.7 }, // G5
    ],
    totalDuration: 0.25,
  },

  interaction_click: {
    name: 'soft_interaction_click',
    tones: [
      // Barely audible tap
      { frequency: 800, duration: 0.02, startTime: 0, volumeMultiplier: 0.3 },
    ],
    totalDuration: 0.02,
  },

  error_buzz: {
    name: 'soft_error_buzz',
    tones: [
      // Soft low tone
      { frequency: 200, duration: 0.12, startTime: 0, waveType: 'sine', volumeMultiplier: 0.5 },
    ],
    totalDuration: 0.12,
  },
};

// ========== MINIMAL PRESET ==========
// Subtle, unobtrusive sounds for focused work

const minimalSounds: SoundPresetDefinitions = {
  start: {
    name: 'minimal_start',
    tones: [{ frequency: 440, duration: 0.08, startTime: 0, volumeMultiplier: 0.6 }],
    totalDuration: 0.08,
  },

  stop: {
    name: 'minimal_stop',
    tones: [{ frequency: 330, duration: 0.08, startTime: 0, volumeMultiplier: 0.6 }],
    totalDuration: 0.08,
  },

  'phase-change': {
    name: 'minimal_phase_change',
    tones: [{ frequency: 550, duration: 0.06, startTime: 0, volumeMultiplier: 0.5 }],
    totalDuration: 0.06,
  },

  'countdown-complete': {
    name: 'minimal_countdown_complete',
    tones: [
      { frequency: 440, duration: 0.1, startTime: 0, volumeMultiplier: 0.6 },
      { frequency: 550, duration: 0.15, startTime: 0.12, volumeMultiplier: 0.7 },
    ],
    totalDuration: 0.3,
  },

  achievement_unlock: {
    name: 'minimal_achievement_unlock',
    tones: [
      { frequency: 523.25, duration: 0.15, startTime: 0, volumeMultiplier: 0.6 }, // C5
      { frequency: 659.25, duration: 0.2, startTime: 0.12, volumeMultiplier: 0.7 }, // E5
    ],
    totalDuration: 0.35,
  },

  notification_chime: {
    name: 'minimal_notification_chime',
    tones: [{ frequency: 660, duration: 0.1, startTime: 0, volumeMultiplier: 0.5 }],
    totalDuration: 0.1,
  },

  interaction_click: {
    name: 'minimal_interaction_click',
    tones: [{ frequency: 1000, duration: 0.015, startTime: 0, volumeMultiplier: 0.2 }],
    totalDuration: 0.015,
  },

  error_buzz: {
    name: 'minimal_error_buzz',
    tones: [
      { frequency: 180, duration: 0.08, startTime: 0, waveType: 'sine', volumeMultiplier: 0.4 },
    ],
    totalDuration: 0.08,
  },
};

/**
 * All sound presets mapped by preset name.
 */
export const SOUND_PRESETS: Record<string, SoundPresetDefinitions> = {
  classic: classicSounds,
  soft: softSounds,
  minimal: minimalSounds,
};

/**
 * Get the sound definition for a specific event and preset.
 *
 * @param event - The sound event type
 * @param preset - The sound preset name (classic, soft, minimal)
 * @returns The sound definition for that event/preset combo
 */
export function getSoundDefinition(
  event: SoundEventType,
  preset: string = 'classic'
): SoundDefinition {
  const presetSounds = SOUND_PRESETS[preset] || SOUND_PRESETS.classic;
  return presetSounds[event];
}

/**
 * List of all available sound event types.
 */
export const ALL_SOUND_EVENTS: SoundEventType[] = [
  'start',
  'stop',
  'phase-change',
  'countdown-complete',
  'achievement_unlock',
  'notification_chime',
  'interaction_click',
  'error_buzz',
];

/**
 * Human-readable names for sound events.
 */
export const SOUND_EVENT_NAMES: Record<SoundEventType, string> = {
  start: 'Timer Start',
  stop: 'Timer Stop',
  'phase-change': 'Phase Change',
  'countdown-complete': 'Countdown Complete',
  achievement_unlock: 'Achievement Unlock',
  notification_chime: 'Notification Chime',
  interaction_click: 'Interaction Click',
  error_buzz: 'Error Buzz',
};

/**
 * Human-readable names for sound presets.
 */
export const SOUND_PRESET_NAMES: Record<string, string> = {
  classic: 'Classic',
  soft: 'Soft',
  minimal: 'Minimal',
};

/**
 * Descriptions for sound presets.
 */
export const SOUND_PRESET_DESCRIPTIONS: Record<string, string> = {
  classic: 'Bold, clear sounds with strong tones',
  soft: 'Gentler sounds with rounded frequencies',
  minimal: 'Subtle, unobtrusive audio feedback',
};
