/**
 * Timer Sounds Hook Tests
 *
 * Tests for sound system functionality including:
 * - No-op behavior on non-web platforms
 * - Sound event handling
 * - Preset support
 *
 * Note: Hook integration tests would require proper React rendering setup.
 * These tests focus on the exported types and structure which can be tested directly.
 */

// Import sound definitions for testing
import {
  SOUND_PRESETS,
  getSoundDefinition,
  ALL_SOUND_EVENTS,
  SOUND_EVENT_NAMES,
  SOUND_PRESET_NAMES,
  SOUND_PRESET_DESCRIPTIONS,
  type SoundEventType,
} from '@/lib/sounds';

describe('Sound System Definitions', () => {
  describe('SOUND_PRESETS', () => {
    it('should have all three presets defined', () => {
      expect(SOUND_PRESETS).toHaveProperty('classic');
      expect(SOUND_PRESETS).toHaveProperty('soft');
      expect(SOUND_PRESETS).toHaveProperty('minimal');
    });

    it('should have all sound events for each preset', () => {
      const presets = ['classic', 'soft', 'minimal'];
      const events: SoundEventType[] = [
        'start',
        'stop',
        'phase-change',
        'countdown-complete',
        'achievement_unlock',
        'notification_chime',
        'interaction_click',
        'error_buzz',
      ];

      presets.forEach(preset => {
        events.forEach(event => {
          expect(SOUND_PRESETS[preset]).toHaveProperty(event);
          const definition = SOUND_PRESETS[preset][event];
          expect(definition).toHaveProperty('name');
          expect(definition).toHaveProperty('totalDuration');
          expect(definition.totalDuration).toBeGreaterThan(0);
        });
      });
    });
  });

  describe('getSoundDefinition', () => {
    it('should return correct definition for each preset and event', () => {
      const presets = ['classic', 'soft', 'minimal'];
      const events: SoundEventType[] = ['start', 'stop', 'achievement_unlock'];

      presets.forEach(preset => {
        events.forEach(event => {
          const definition = getSoundDefinition(event, preset);
          expect(definition).toBeDefined();
          expect(definition.name).toContain(preset.toLowerCase().replace('-', '_'));
        });
      });
    });

    it('should default to classic preset if invalid preset provided', () => {
      const definition = getSoundDefinition('start', 'invalid-preset');
      expect(definition.name).toBe('classic_start');
    });

    it('should default to classic preset if no preset provided', () => {
      const definition = getSoundDefinition('start');
      expect(definition.name).toBe('classic_start');
    });
  });

  describe('ALL_SOUND_EVENTS', () => {
    it('should contain all expected sound events', () => {
      const expectedEvents: SoundEventType[] = [
        'start',
        'stop',
        'phase-change',
        'countdown-complete',
        'achievement_unlock',
        'notification_chime',
        'interaction_click',
        'error_buzz',
      ];

      expect(ALL_SOUND_EVENTS).toHaveLength(expectedEvents.length);
      expectedEvents.forEach(event => {
        expect(ALL_SOUND_EVENTS).toContain(event);
      });
    });
  });

  describe('SOUND_EVENT_NAMES', () => {
    it('should have human-readable names for all events', () => {
      ALL_SOUND_EVENTS.forEach(event => {
        expect(SOUND_EVENT_NAMES).toHaveProperty(event);
        expect(typeof SOUND_EVENT_NAMES[event]).toBe('string');
        expect(SOUND_EVENT_NAMES[event].length).toBeGreaterThan(0);
      });
    });

    it('should have proper names for key events', () => {
      expect(SOUND_EVENT_NAMES.start).toBe('Timer Start');
      expect(SOUND_EVENT_NAMES.stop).toBe('Timer Stop');
      expect(SOUND_EVENT_NAMES.achievement_unlock).toBe('Achievement Unlock');
      expect(SOUND_EVENT_NAMES.error_buzz).toBe('Error Buzz');
    });
  });

  describe('SOUND_PRESET_NAMES', () => {
    it('should have names for all presets', () => {
      const presets = ['classic', 'soft', 'minimal'];
      presets.forEach(preset => {
        expect(SOUND_PRESET_NAMES).toHaveProperty(preset);
        expect(typeof SOUND_PRESET_NAMES[preset]).toBe('string');
      });
    });
  });

  describe('SOUND_PRESET_DESCRIPTIONS', () => {
    it('should have descriptions for all presets', () => {
      const presets = ['classic', 'soft', 'minimal'];
      presets.forEach(preset => {
        expect(SOUND_PRESET_DESCRIPTIONS).toHaveProperty(preset);
        expect(typeof SOUND_PRESET_DESCRIPTIONS[preset]).toBe('string');
        expect(SOUND_PRESET_DESCRIPTIONS[preset].length).toBeGreaterThan(0);
      });
    });
  });
});

describe('Sound Definition Structure', () => {
  it('should have tones or sweeps in each definition', () => {
    Object.entries(SOUND_PRESETS).forEach(([_presetName, preset]) => {
      Object.entries(preset).forEach(([_eventName, definition]) => {
        const hasTones = definition.tones && definition.tones.length > 0;
        const hasSweeps = definition.sweeps && definition.sweeps.length > 0;
        expect(hasTones || hasSweeps).toBe(true);
      });
    });
  });

  it('should have unique names for all definitions', () => {
    const allNames = new Set<string>();

    Object.entries(SOUND_PRESETS).forEach(([_presetName, preset]) => {
      Object.entries(preset).forEach(([_eventName, definition]) => {
        expect(allNames.has(definition.name)).toBe(false);
        allNames.add(definition.name);
      });
    });
  });

  it('should have valid tone properties', () => {
    Object.entries(SOUND_PRESETS).forEach(([_presetName, preset]) => {
      Object.entries(preset).forEach(([_eventName, definition]) => {
        if (definition.tones) {
          definition.tones.forEach(tone => {
            expect(tone.frequency).toBeGreaterThan(0);
            expect(tone.duration).toBeGreaterThan(0);
            expect(tone.startTime).toBeGreaterThanOrEqual(0);
          });
        }
      });
    });
  });

  it('should have valid sweep properties', () => {
    Object.entries(SOUND_PRESETS).forEach(([_presetName, preset]) => {
      Object.entries(preset).forEach(([_eventName, definition]) => {
        if (definition.sweeps) {
          definition.sweeps.forEach(sweep => {
            expect(sweep.startFrequency).toBeGreaterThan(0);
            expect(sweep.endFrequency).toBeGreaterThan(0);
            expect(sweep.duration).toBeGreaterThan(0);
            expect(sweep.startTime).toBeGreaterThanOrEqual(0);
          });
        }
      });
    });
  });
});

describe('Preset Characteristics', () => {
  it('classic preset should have generally longer sounds than minimal', () => {
    const classicStart = getSoundDefinition('start', 'classic');
    const minimalStart = getSoundDefinition('start', 'minimal');
    expect(classicStart.totalDuration).toBeGreaterThan(minimalStart.totalDuration);
  });

  it('minimal preset should have the shortest interaction_click', () => {
    const classicClick = getSoundDefinition('interaction_click', 'classic');
    const minimalClick = getSoundDefinition('interaction_click', 'minimal');
    expect(minimalClick.totalDuration).toBeLessThanOrEqual(classicClick.totalDuration);
  });

  it('achievement_unlock should be longer than interaction_click', () => {
    const presets = ['classic', 'soft', 'minimal'];
    presets.forEach(preset => {
      const achievement = getSoundDefinition('achievement_unlock', preset);
      const click = getSoundDefinition('interaction_click', preset);
      expect(achievement.totalDuration).toBeGreaterThan(click.totalDuration);
    });
  });
});

describe('Error Buzz Sound', () => {
  it('should use lower frequencies than achievement sounds', () => {
    const presets = ['classic', 'soft', 'minimal'];
    presets.forEach(preset => {
      const error = getSoundDefinition('error_buzz', preset);
      const achievement = getSoundDefinition('achievement_unlock', preset);

      const errorFreq = error.tones ? error.tones[0].frequency : 0;
      const achievementFreq = achievement.tones ? achievement.tones[0].frequency : 0;

      expect(errorFreq).toBeLessThan(achievementFreq);
    });
  });
});
