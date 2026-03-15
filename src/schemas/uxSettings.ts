import { z } from 'zod';

/**
 * Sound Preset Schema
 *
 * Defines available sound presets for audio feedback.
 * Each preset has a distinct character for different user preferences.
 */
export const SoundPresetEnum = z.enum(['classic', 'soft', 'minimal']);

/**
 * UX Settings Schema
 *
 * Schema for validating user experience settings stored locally.
 * These settings control animations, haptics, and sound preferences.
 */
export const UXSettingsSchema = z.object({
  /**
   * Whether animations are enabled throughout the app.
   * When false, transitions should be instant.
   */
  animationsEnabled: z.boolean().default(true),

  /**
   * Whether the system prefers reduced motion.
   * Synced automatically from system accessibility settings.
   * When true, animations should be simplified or disabled.
   */
  reducedMotion: z.boolean().default(false),

  /**
   * Whether haptic feedback is enabled.
   * Only applies on mobile devices; ignored on web/desktop.
   */
  hapticFeedbackEnabled: z.boolean().default(true),

  /**
   * Whether sound effects are enabled.
   * Migrated from timerSettingsStore.
   */
  soundEnabled: z.boolean().default(false),

  /**
   * Volume level for sound effects (0.0 to 1.0).
   * Migrated from timerSettingsStore.
   */
  soundVolume: z.number().min(0).max(1).default(0.7),

  /**
   * Selected sound preset for audio feedback.
   * Controls the style of sounds played throughout the app.
   */
  soundPreset: SoundPresetEnum.default('classic'),
});

/**
 * Partial UX Settings Schema
 *
 * For updating individual settings without requiring all fields.
 */
export const UpdateUXSettingsSchema = z.object({
  animationsEnabled: z.boolean().optional(),
  reducedMotion: z.boolean().optional(),
  hapticFeedbackEnabled: z.boolean().optional(),
  soundEnabled: z.boolean().optional(),
  soundVolume: z.number().min(0).max(1).optional(),
  soundPreset: SoundPresetEnum.optional(),
});

// Inferred TypeScript types
export type SoundPreset = z.infer<typeof SoundPresetEnum>;
export type UXSettings = z.infer<typeof UXSettingsSchema>;
export type UpdateUXSettingsInput = z.infer<typeof UpdateUXSettingsSchema>;
