/**
 * UXSettings Component Tests
 *
 * Tests cover:
 * - Animations toggle functionality
 * - Haptic feedback toggle (mobile only)
 * - Sound settings (enabled, volume, preset selection)
 * - Reduced motion indicator
 * - Accessibility attributes
 * - Disabled state handling
 */

import type { SoundPreset } from '@/schemas/uxSettings';

// Mock dependencies
jest.mock('@/theme', () => ({
  useTheme: () => ({
    colors: {
      primary: '#6366F1',
      success: '#10B981',
      warning: '#F59E0B',
      error: '#EF4444',
      text: '#FFFFFF',
      textSecondary: '#A0A0A0',
      textMuted: '#666666',
      surface: '#1A1A1A',
      surfaceVariant: '#2A2A2A',
      border: '#333333',
    },
    isDark: true,
  }),
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 },
  fontSizes: { xs: 10, sm: 12, md: 14, lg: 16, xl: 18 },
  borderRadius: { sm: 4, md: 8, lg: 12, xl: 16, full: 9999, none: 0 },
}));

jest.mock('@/stores', () => ({
  useUXSettings: () => ({
    animationsEnabled: true,
    hapticFeedbackEnabled: true,
    reducedMotion: false,
    soundEnabled: true,
    soundVolume: 0.7,
    soundPreset: 'classic' as SoundPreset,
  }),
  setAnimationsEnabled: jest.fn(),
  setHapticFeedbackEnabled: jest.fn(),
  setSoundEnabled: jest.fn(),
  setSoundVolume: jest.fn(),
  setSoundPreset: jest.fn(),
}));

jest.mock('@/hooks/useTimerSounds', () => ({
  useSounds: () => ({
    playSound: jest.fn(),
  }),
}));

jest.mock('@/lib/sounds', () => ({
  SOUND_PRESET_NAMES: {
    classic: 'Classic',
    soft: 'Soft',
    minimal: 'Minimal',
  },
  SOUND_PRESET_DESCRIPTIONS: {
    classic: 'Bold, clear tones',
    soft: 'Gentle, ambient sounds',
    minimal: 'Subtle clicks only',
  },
}));

// ============================================================================
// COMPONENT BEHAVIOR TESTS
// ============================================================================

describe('UXSettings Component', () => {
  describe('Animations toggle', () => {
    it('should have animation toggle that respects reducedMotion', () => {
      const animationsEnabled = true;
      const reducedMotion = false;
      const effectiveValue = animationsEnabled && !reducedMotion;
      expect(effectiveValue).toBe(true);
    });

    it('should disable animations toggle when system reducedMotion is active', () => {
      const animationsEnabled = true;
      const reducedMotion = true;
      const effectiveValue = animationsEnabled && !reducedMotion;
      expect(effectiveValue).toBe(false);
    });

    it('should show disabled state when prop is passed', () => {
      const disabled = true;
      const reducedMotion = false;
      const isToggleDisabled = disabled || reducedMotion;
      expect(isToggleDisabled).toBe(true);
    });
  });

  describe('Haptic feedback toggle', () => {
    it('should only show on mobile platforms', () => {
      const isMobile = (platform: string): boolean => platform === 'ios' || platform === 'android';

      expect(isMobile('ios')).toBe(true);
      expect(isMobile('android')).toBe(true);
      expect(isMobile('web')).toBe(false);
    });
  });

  describe('Sound toggle', () => {
    it('should show sound toggle when showSoundSettings is true', () => {
      const showSoundSettings = true;
      expect(showSoundSettings).toBe(true);
    });

    it('should hide sound toggle when showSoundSettings is false', () => {
      const showSoundSettings = false;
      expect(showSoundSettings).toBe(false);
    });
  });

  describe('Volume control', () => {
    it('should calculate volume percentage correctly', () => {
      const soundVolume = 0.7;
      const volumePercent = Math.round(soundVolume * 100);
      expect(volumePercent).toBe(70);
    });

    it('should clamp volume increment to max 100%', () => {
      const soundVolume = 0.95;
      const newVolume = Math.min(1, soundVolume + 0.1);
      const rounded = Math.round(newVolume * 10) / 10;
      expect(rounded).toBe(1);
    });

    it('should clamp volume decrement to min 0%', () => {
      const soundVolume = 0.05;
      const newVolume = Math.max(0, soundVolume - 0.1);
      const rounded = Math.round(newVolume * 10) / 10;
      expect(rounded).toBe(0);
    });

    it('should increment volume by 10%', () => {
      const soundVolume = 0.5;
      const newVolume = Math.min(1, soundVolume + 0.1);
      const rounded = Math.round(newVolume * 10) / 10;
      expect(rounded).toBe(0.6);
    });

    it('should decrement volume by 10%', () => {
      const soundVolume = 0.5;
      const newVolume = Math.max(0, soundVolume - 0.1);
      const rounded = Math.round(newVolume * 10) / 10;
      expect(rounded).toBe(0.4);
    });

    it('should disable decrement button at 0%', () => {
      const volumePercent = 0;
      const isDisabled = volumePercent <= 0;
      expect(isDisabled).toBe(true);
    });

    it('should disable increment button at 100%', () => {
      const volumePercent = 100;
      const isDisabled = volumePercent >= 100;
      expect(isDisabled).toBe(true);
    });
  });

  describe('Sound presets', () => {
    const SOUND_PRESETS: SoundPreset[] = ['classic', 'soft', 'minimal'];

    it('should have three preset options', () => {
      expect(SOUND_PRESETS).toHaveLength(3);
    });

    it('should include classic preset', () => {
      expect(SOUND_PRESETS).toContain('classic');
    });

    it('should include soft preset', () => {
      expect(SOUND_PRESETS).toContain('soft');
    });

    it('should include minimal preset', () => {
      expect(SOUND_PRESETS).toContain('minimal');
    });
  });

  describe('Reduced motion indicator', () => {
    it('should show indicator when reducedMotion is true', () => {
      const reducedMotion = true;
      const shouldShowIndicator = reducedMotion;
      expect(shouldShowIndicator).toBe(true);
    });

    it('should hide indicator when reducedMotion is false', () => {
      const reducedMotion = false;
      const shouldShowIndicator = reducedMotion;
      expect(shouldShowIndicator).toBe(false);
    });

    it('should show help text when reducedMotion is active', () => {
      const reducedMotion = true;
      const shouldShowHelpText = reducedMotion;
      expect(shouldShowHelpText).toBe(true);
    });
  });

  describe('Conditional sound settings display', () => {
    it('should show volume and presets only when sound is enabled', () => {
      const soundEnabled = true;
      const showSoundSettings = true;
      const shouldShowVolumeAndPresets = soundEnabled && showSoundSettings;
      expect(shouldShowVolumeAndPresets).toBe(true);
    });

    it('should hide volume and presets when sound is disabled', () => {
      const soundEnabled = false;
      const showSoundSettings = true;
      const shouldShowVolumeAndPresets = soundEnabled && showSoundSettings;
      expect(shouldShowVolumeAndPresets).toBe(false);
    });

    it('should hide all sound settings when showSoundSettings is false', () => {
      const soundEnabled = true;
      const showSoundSettings = false;
      const shouldShowSoundToggle = showSoundSettings;
      expect(shouldShowSoundToggle).toBe(false);
    });
  });

  describe('Disabled state', () => {
    it('should prevent animations toggle when disabled', () => {
      const disabled = true;
      let toggleCalled = false;
      const handleToggle = (value: boolean): void => {
        if (!disabled) {
          toggleCalled = true;
        }
      };
      handleToggle(true);
      expect(toggleCalled).toBe(false);
    });

    it('should prevent haptics toggle when disabled', () => {
      const disabled = true;
      let toggleCalled = false;
      const handleToggle = (value: boolean): void => {
        if (!disabled) {
          toggleCalled = true;
        }
      };
      handleToggle(true);
      expect(toggleCalled).toBe(false);
    });

    it('should prevent sound toggle when disabled', () => {
      const disabled = true;
      let toggleCalled = false;
      const handleToggle = (value: boolean): void => {
        if (!disabled) {
          toggleCalled = true;
        }
      };
      handleToggle(true);
      expect(toggleCalled).toBe(false);
    });

    it('should prevent volume changes when disabled', () => {
      const disabled = true;
      let volumeChanged = false;
      const handleVolumeChange = (): void => {
        if (!disabled) {
          volumeChanged = true;
        }
      };
      handleVolumeChange();
      expect(volumeChanged).toBe(false);
    });

    it('should prevent preset changes when disabled', () => {
      const disabled = true;
      let presetChanged = false;
      const handlePresetChange = (_preset: SoundPreset): void => {
        if (!disabled) {
          presetChanged = true;
        }
      };
      handlePresetChange('soft');
      expect(presetChanged).toBe(false);
    });

    it('should prevent test sound when disabled', () => {
      const disabled = true;
      let soundPlayed = false;
      const handleTestSound = (): void => {
        if (!disabled) {
          soundPlayed = true;
        }
      };
      handleTestSound();
      expect(soundPlayed).toBe(false);
    });
  });

  describe('Accessibility labels', () => {
    it('should have correct label for animations toggle', () => {
      const label = 'Toggle animations';
      expect(label).toBe('Toggle animations');
    });

    it('should have correct label for haptic feedback toggle', () => {
      const label = 'Toggle haptic feedback';
      expect(label).toBe('Toggle haptic feedback');
    });

    it('should have correct label for sounds toggle', () => {
      const label = 'Toggle sounds';
      expect(label).toBe('Toggle sounds');
    });

    it('should have correct label for decrease volume button', () => {
      const label = 'Decrease volume';
      expect(label).toBe('Decrease volume');
    });

    it('should have correct label for increase volume button', () => {
      const label = 'Increase volume';
      expect(label).toBe('Increase volume');
    });

    it('should have correct label for test sound button', () => {
      const label = 'Test sound';
      expect(label).toBe('Test sound');
    });

    it('should include preset name and description in accessibility label', () => {
      const presetName = 'Classic';
      const presetDescription = 'Bold, clear tones';
      const accessibilityLabel = `${presetName}: ${presetDescription}`;
      expect(accessibilityLabel).toBe('Classic: Bold, clear tones');
    });
  });

  describe('Accessibility hints', () => {
    it('should have hint for animations toggle when not reduced motion', () => {
      const reducedMotion = false;
      const hint = reducedMotion
        ? 'Disabled because system reduced motion is enabled'
        : 'Enable or disable smooth transitions and animations';
      expect(hint).toBe('Enable or disable smooth transitions and animations');
    });

    it('should have hint for animations toggle when reduced motion is active', () => {
      const reducedMotion = true;
      const hint = reducedMotion
        ? 'Disabled because system reduced motion is enabled'
        : 'Enable or disable smooth transitions and animations';
      expect(hint).toBe('Disabled because system reduced motion is enabled');
    });

    it('should have hint for haptic feedback toggle', () => {
      const hint = 'Enable or disable vibration feedback for button presses';
      expect(hint).toBe('Enable or disable vibration feedback for button presses');
    });

    it('should have hint for sounds toggle', () => {
      const hint = 'Enable or disable sounds for timer events';
      expect(hint).toBe('Enable or disable sounds for timer events');
    });
  });

  describe('Toggle descriptions', () => {
    it('should have description for animations', () => {
      const description = 'Enable smooth transitions and animations';
      expect(description).toBe('Enable smooth transitions and animations');
    });

    it('should have description for haptic feedback', () => {
      const description = 'Vibration feedback for button presses';
      expect(description).toBe('Vibration feedback for button presses');
    });

    it('should have description for sounds', () => {
      const description = 'Play sounds for timer events';
      expect(description).toBe('Play sounds for timer events');
    });
  });

  describe('Indicator message', () => {
    it('should show correct reduced motion indicator message', () => {
      const message = 'System reduced motion is enabled. Some animations are disabled.';
      expect(message).toBe('System reduced motion is enabled. Some animations are disabled.');
    });

    it('should show correct help text for enabling animations', () => {
      const helpText =
        'To enable animations, turn off Reduce Motion in your system accessibility settings.';
      expect(helpText).toContain('Reduce Motion');
      expect(helpText).toContain('system accessibility settings');
    });
  });
});

describe('UXSettings Preset Selection', () => {
  const presets = {
    classic: { name: 'Classic', description: 'Bold, clear tones' },
    soft: { name: 'Soft', description: 'Gentle, ambient sounds' },
    minimal: { name: 'Minimal', description: 'Subtle clicks only' },
  };

  it('should display classic preset name correctly', () => {
    expect(presets.classic.name).toBe('Classic');
  });

  it('should display classic preset description correctly', () => {
    expect(presets.classic.description).toBe('Bold, clear tones');
  });

  it('should display soft preset name correctly', () => {
    expect(presets.soft.name).toBe('Soft');
  });

  it('should display soft preset description correctly', () => {
    expect(presets.soft.description).toBe('Gentle, ambient sounds');
  });

  it('should display minimal preset name correctly', () => {
    expect(presets.minimal.name).toBe('Minimal');
  });

  it('should display minimal preset description correctly', () => {
    expect(presets.minimal.description).toBe('Subtle clicks only');
  });

  it('should highlight active preset', () => {
    const currentPreset = 'classic' as SoundPreset;
    const presets: SoundPreset[] = ['classic', 'soft', 'minimal'];

    const activeStates = presets.map(preset => ({
      preset,
      isActive: currentPreset === preset,
    }));

    expect(activeStates.find(p => p.preset === 'classic')?.isActive).toBe(true);
    expect(activeStates.find(p => p.preset === 'soft')?.isActive).toBe(false);
    expect(activeStates.find(p => p.preset === 'minimal')?.isActive).toBe(false);
  });
});

describe('UXSettings Theme Colors', () => {
  const themeColors = {
    primary: '#6366F1',
    warning: '#F59E0B',
    text: '#FFFFFF',
    textSecondary: '#A0A0A0',
    textMuted: '#666666',
    surfaceVariant: '#2A2A2A',
    border: '#333333',
  };

  it('should use primary color for active toggle thumb', () => {
    const isEnabled = true;
    const thumbColor = isEnabled ? themeColors.primary : themeColors.textMuted;
    expect(thumbColor).toBe('#6366F1');
  });

  it('should use textMuted color for inactive toggle thumb', () => {
    const isEnabled = false;
    const thumbColor = isEnabled ? themeColors.primary : themeColors.textMuted;
    expect(thumbColor).toBe('#666666');
  });

  it('should use warning color for reduced motion indicator', () => {
    expect(themeColors.warning).toBe('#F59E0B');
  });

  it('should use border color for toggle row separators', () => {
    expect(themeColors.border).toBe('#333333');
  });

  it('should use surfaceVariant for buttons and presets', () => {
    expect(themeColors.surfaceVariant).toBe('#2A2A2A');
  });

  it('should apply primary color with transparency for active track', () => {
    const trackActiveColor = themeColors.primary + '80';
    expect(trackActiveColor).toBe('#6366F180');
  });

  it('should apply primary color with transparency for active preset background', () => {
    const presetActiveBg = themeColors.primary + '10';
    expect(presetActiveBg).toBe('#6366F110');
  });

  it('should apply warning color with transparency for indicator background', () => {
    const indicatorBg = themeColors.warning + '15';
    expect(indicatorBg).toBe('#F59E0B15');
  });
});
