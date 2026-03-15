/**
 * Achievement Schema Tests
 *
 * Tests for achievement schema validation including:
 * - Achievement ID enum validation
 * - Achievement category enum validation
 * - Achievement definition schema
 * - User achievement progress schema
 * - Achievement state persistence schema
 */

import {
  AchievementIdEnum,
  AchievementCategoryEnum,
  AchievementDefinitionSchema,
  UserAchievementSchema,
  AchievementSchema,
  AchievementStateSchema,
  ACHIEVEMENT_DEFINITIONS,
  ALL_ACHIEVEMENT_IDS,
  DEFAULT_ACHIEVEMENT_STATE,
  type AchievementId,
  type AchievementDefinition,
  type UserAchievement,
  type Achievement,
  type AchievementState,
} from '@/schemas/achievement';

describe('Achievement Schemas', () => {
  describe('AchievementIdEnum', () => {
    it('should include all expected achievement IDs', () => {
      const expectedIds: AchievementId[] = [
        'STREAK_3',
        'STREAK_7',
        'STREAK_14',
        'STREAK_30',
        'TIME_10H',
        'TIME_50H',
        'TIME_100H',
        'FIRST_ENTRY',
        'FIRST_CATEGORY',
        'FIRST_GOAL',
      ];

      expect(AchievementIdEnum.options).toEqual(expectedIds);
    });

    it('should validate valid achievement IDs', () => {
      expect(AchievementIdEnum.safeParse('STREAK_3').success).toBe(true);
      expect(AchievementIdEnum.safeParse('TIME_100H').success).toBe(true);
      expect(AchievementIdEnum.safeParse('FIRST_ENTRY').success).toBe(true);
    });

    it('should reject invalid achievement IDs', () => {
      expect(AchievementIdEnum.safeParse('INVALID_ID').success).toBe(false);
      expect(AchievementIdEnum.safeParse('').success).toBe(false);
      expect(AchievementIdEnum.safeParse(123).success).toBe(false);
      expect(AchievementIdEnum.safeParse(null).success).toBe(false);
    });
  });

  describe('AchievementCategoryEnum', () => {
    it('should include all expected categories', () => {
      expect(AchievementCategoryEnum.options).toEqual(['streak', 'time', 'first']);
    });

    it('should validate valid categories', () => {
      expect(AchievementCategoryEnum.safeParse('streak').success).toBe(true);
      expect(AchievementCategoryEnum.safeParse('time').success).toBe(true);
      expect(AchievementCategoryEnum.safeParse('first').success).toBe(true);
    });

    it('should reject invalid categories', () => {
      expect(AchievementCategoryEnum.safeParse('invalid').success).toBe(false);
      expect(AchievementCategoryEnum.safeParse('').success).toBe(false);
    });
  });

  describe('AchievementDefinitionSchema', () => {
    const validDefinition: AchievementDefinition = {
      id: 'STREAK_3',
      name: '3-Day Streak',
      description: 'Track time for 3 consecutive days',
      icon: 'local-fire-department',
      category: 'streak',
      targetValue: 3,
    };

    it('should validate a valid achievement definition', () => {
      const result = AchievementDefinitionSchema.safeParse(validDefinition);
      expect(result.success).toBe(true);
    });

    it('should require id', () => {
      const { id, ...rest } = validDefinition;
      const result = AchievementDefinitionSchema.safeParse(rest);
      expect(result.success).toBe(false);
    });

    it('should require name with min length', () => {
      expect(AchievementDefinitionSchema.safeParse({ ...validDefinition, name: '' }).success).toBe(
        false
      );
    });

    it('should require name with max length', () => {
      const longName = 'a'.repeat(101);
      expect(
        AchievementDefinitionSchema.safeParse({ ...validDefinition, name: longName }).success
      ).toBe(false);
    });

    it('should require description with min length', () => {
      expect(
        AchievementDefinitionSchema.safeParse({ ...validDefinition, description: '' }).success
      ).toBe(false);
    });

    it('should allow optional targetValue', () => {
      const { targetValue, ...rest } = validDefinition;
      const result = AchievementDefinitionSchema.safeParse(rest);
      expect(result.success).toBe(true);
    });

    it('should require non-negative targetValue', () => {
      expect(
        AchievementDefinitionSchema.safeParse({ ...validDefinition, targetValue: -1 }).success
      ).toBe(false);
    });
  });

  describe('UserAchievementSchema', () => {
    const validUserAchievement: UserAchievement = {
      id: 'STREAK_7',
      progress: 5,
      unlockedAt: null,
      acknowledged: false,
    };

    it('should validate a valid user achievement', () => {
      const result = UserAchievementSchema.safeParse(validUserAchievement);
      expect(result.success).toBe(true);
    });

    it('should validate unlocked achievement', () => {
      const unlockedAchievement: UserAchievement = {
        ...validUserAchievement,
        unlockedAt: '2024-03-15T10:30:00.000Z',
        acknowledged: true,
      };
      const result = UserAchievementSchema.safeParse(unlockedAchievement);
      expect(result.success).toBe(true);
    });

    it('should require valid achievement id', () => {
      expect(
        UserAchievementSchema.safeParse({ ...validUserAchievement, id: 'INVALID' }).success
      ).toBe(false);
    });

    it('should require non-negative progress', () => {
      expect(
        UserAchievementSchema.safeParse({ ...validUserAchievement, progress: -1 }).success
      ).toBe(false);
    });

    it('should allow progress greater than target', () => {
      // Progress can exceed target (e.g., 35 day streak for 30 day achievement)
      const result = UserAchievementSchema.safeParse({
        ...validUserAchievement,
        progress: 100,
      });
      expect(result.success).toBe(true);
    });

    it('should validate ISO 8601 datetime for unlockedAt', () => {
      expect(
        UserAchievementSchema.safeParse({
          ...validUserAchievement,
          unlockedAt: 'not-a-date',
        }).success
      ).toBe(false);

      expect(
        UserAchievementSchema.safeParse({
          ...validUserAchievement,
          unlockedAt: '2024-03-15T10:30:00.000Z',
        }).success
      ).toBe(true);
    });
  });

  describe('AchievementSchema (combined)', () => {
    const validAchievement: Achievement = {
      id: 'TIME_50H',
      name: 'Dedicated Worker',
      description: 'Log a total of 50 hours',
      icon: 'access-time',
      category: 'time',
      targetValue: 50,
      progress: 35,
      progressPercent: 70,
      unlockedAt: null,
      isUnlocked: false,
    };

    it('should validate a complete achievement', () => {
      const result = AchievementSchema.safeParse(validAchievement);
      expect(result.success).toBe(true);
    });

    it('should validate an unlocked achievement', () => {
      const unlocked: Achievement = {
        ...validAchievement,
        progress: 50,
        progressPercent: 100,
        unlockedAt: '2024-03-15T12:00:00.000Z',
        isUnlocked: true,
      };
      const result = AchievementSchema.safeParse(unlocked);
      expect(result.success).toBe(true);
    });

    it('should allow progressPercent > 100 for overachievement', () => {
      const overachieved: Achievement = {
        ...validAchievement,
        progress: 75,
        progressPercent: 150, // 150% of target
        unlockedAt: '2024-03-15T12:00:00.000Z',
        isUnlocked: true,
      };
      const result = AchievementSchema.safeParse(overachieved);
      expect(result.success).toBe(true);
    });
  });

  describe('AchievementStateSchema', () => {
    it('should validate empty state with defaults', () => {
      const emptyState = { version: 1 };
      const result = AchievementStateSchema.safeParse(emptyState);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.pendingNotifications).toEqual([]);
      }
    });

    it('should validate complete state', () => {
      const completeState = {
        version: 1,
        achievements: {
          STREAK_3: {
            id: 'STREAK_3',
            progress: 3,
            unlockedAt: '2024-03-15T10:00:00.000Z',
            acknowledged: true,
          },
        },
        lastCalculatedAt: '2024-03-15T12:00:00.000Z',
        pendingNotifications: ['FIRST_ENTRY'],
      };
      const result = AchievementStateSchema.safeParse(completeState);
      expect(result.success).toBe(true);
    });

    it('should require positive version number', () => {
      expect(AchievementStateSchema.safeParse({ version: 0 }).success).toBe(false);
      expect(AchievementStateSchema.safeParse({ version: -1 }).success).toBe(false);
      expect(AchievementStateSchema.safeParse({ version: 1 }).success).toBe(true);
    });

    it('should validate achievement IDs in pendingNotifications', () => {
      const validState = {
        version: 1,
        pendingNotifications: ['STREAK_3', 'TIME_10H'],
      };
      const result = AchievementStateSchema.safeParse(validState);
      expect(result.success).toBe(true);

      const invalidState = {
        version: 1,
        pendingNotifications: ['INVALID_ID'],
      };
      const invalidResult = AchievementStateSchema.safeParse(invalidState);
      expect(invalidResult.success).toBe(false);
    });
  });
});

describe('Achievement Definitions', () => {
  it('should have definitions for all achievement IDs', () => {
    ALL_ACHIEVEMENT_IDS.forEach(id => {
      expect(ACHIEVEMENT_DEFINITIONS[id]).toBeDefined();
    });
  });

  it('should have valid definitions for all achievements', () => {
    Object.values(ACHIEVEMENT_DEFINITIONS).forEach(def => {
      const result = AchievementDefinitionSchema.safeParse(def);
      expect(result.success).toBe(true);
    });
  });

  describe('streak achievements', () => {
    it('should have correct target values', () => {
      expect(ACHIEVEMENT_DEFINITIONS.STREAK_3.targetValue).toBe(3);
      expect(ACHIEVEMENT_DEFINITIONS.STREAK_7.targetValue).toBe(7);
      expect(ACHIEVEMENT_DEFINITIONS.STREAK_14.targetValue).toBe(14);
      expect(ACHIEVEMENT_DEFINITIONS.STREAK_30.targetValue).toBe(30);
    });

    it('should be in streak category', () => {
      expect(ACHIEVEMENT_DEFINITIONS.STREAK_3.category).toBe('streak');
      expect(ACHIEVEMENT_DEFINITIONS.STREAK_7.category).toBe('streak');
      expect(ACHIEVEMENT_DEFINITIONS.STREAK_14.category).toBe('streak');
      expect(ACHIEVEMENT_DEFINITIONS.STREAK_30.category).toBe('streak');
    });
  });

  describe('time achievements', () => {
    it('should have correct target values in hours', () => {
      expect(ACHIEVEMENT_DEFINITIONS.TIME_10H.targetValue).toBe(10);
      expect(ACHIEVEMENT_DEFINITIONS.TIME_50H.targetValue).toBe(50);
      expect(ACHIEVEMENT_DEFINITIONS.TIME_100H.targetValue).toBe(100);
    });

    it('should be in time category', () => {
      expect(ACHIEVEMENT_DEFINITIONS.TIME_10H.category).toBe('time');
      expect(ACHIEVEMENT_DEFINITIONS.TIME_50H.category).toBe('time');
      expect(ACHIEVEMENT_DEFINITIONS.TIME_100H.category).toBe('time');
    });
  });

  describe('first achievements', () => {
    it('should have target value of 1', () => {
      expect(ACHIEVEMENT_DEFINITIONS.FIRST_ENTRY.targetValue).toBe(1);
      expect(ACHIEVEMENT_DEFINITIONS.FIRST_CATEGORY.targetValue).toBe(1);
      expect(ACHIEVEMENT_DEFINITIONS.FIRST_GOAL.targetValue).toBe(1);
    });

    it('should be in first category', () => {
      expect(ACHIEVEMENT_DEFINITIONS.FIRST_ENTRY.category).toBe('first');
      expect(ACHIEVEMENT_DEFINITIONS.FIRST_CATEGORY.category).toBe('first');
      expect(ACHIEVEMENT_DEFINITIONS.FIRST_GOAL.category).toBe('first');
    });
  });
});

describe('Default Achievement State', () => {
  it('should have version 1', () => {
    expect(DEFAULT_ACHIEVEMENT_STATE.version).toBe(1);
  });

  it('should have empty achievements map', () => {
    expect(DEFAULT_ACHIEVEMENT_STATE.achievements).toEqual({});
  });

  it('should have empty pending notifications', () => {
    expect(DEFAULT_ACHIEVEMENT_STATE.pendingNotifications).toEqual([]);
  });

  it('should validate against schema', () => {
    const result = AchievementStateSchema.safeParse(DEFAULT_ACHIEVEMENT_STATE);
    expect(result.success).toBe(true);
  });
});

describe('Security: Input Validation', () => {
  it('should reject injection attempts in achievement IDs', () => {
    const maliciousId = '<script>alert("xss")</script>';
    expect(AchievementIdEnum.safeParse(maliciousId).success).toBe(false);
  });

  it('should reject SQL injection in category', () => {
    const sqlInjection = "streak'; DROP TABLE achievements; --";
    expect(AchievementCategoryEnum.safeParse(sqlInjection).success).toBe(false);
  });

  it('should sanitize description length', () => {
    const longDescription = 'a'.repeat(501);
    const result = AchievementDefinitionSchema.safeParse({
      id: 'STREAK_3',
      name: 'Test',
      description: longDescription,
      icon: 'test',
      category: 'streak',
    });
    expect(result.success).toBe(false);
  });

  it('should validate numeric types strictly', () => {
    expect(
      UserAchievementSchema.safeParse({
        id: 'STREAK_3',
        progress: 'five', // Should be number
        unlockedAt: null,
        acknowledged: false,
      }).success
    ).toBe(false);
  });
});
