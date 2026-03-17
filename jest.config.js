/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: {
          jsx: 'react-jsx',
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
          moduleResolution: 'node',
          strict: true,
          skipLibCheck: true,
          paths: {
            '@/components': ['src/components/index.ts'],
            '@/components/*': ['src/components/*'],
            '@/hooks': ['src/hooks/index.ts'],
            '@/hooks/*': ['src/hooks/*'],
            '@/lib': ['src/lib/index.ts'],
            '@/lib/*': ['src/lib/*'],
            '@/screens': ['src/screens/index.ts'],
            '@/screens/*': ['src/screens/*'],
            '@/stores': ['src/stores/index.ts'],
            '@/stores/*': ['src/stores/*'],
            '@/types': ['src/types/index.ts'],
            '@/types/*': ['src/types/*'],
            '@/theme': ['src/theme/index.ts'],
            '@/theme/*': ['src/theme/*'],
            '@/services': ['src/services/index.ts'],
            '@/services/*': ['src/services/*'],
            '@/schemas': ['src/schemas/index.ts'],
            '@/schemas/*': ['src/schemas/*'],
            '@/navigation': ['src/navigation/index.tsx'],
            '@/navigation/*': ['src/navigation/*'],
            '@/contexts': ['src/contexts/index.ts'],
            '@/contexts/*': ['src/contexts/*'],
            '@/utils': ['src/utils/index.ts'],
            '@/utils/*': ['src/utils/*'],
          },
          baseUrl: '.',
        },
        useESM: false,
      },
    ],
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    // Mock React Native modules
    '^react-native$': '<rootDir>/src/__tests__/mocks/react-native.ts',
    // Mock testing library (use jest-native builtins)
    '^@testing-library/react-native$':
      '<rootDir>/src/__tests__/mocks/testing-library-react-native.ts',
    // Mock Expo native modules that ship as ESM and can't be transformed by ts-jest
    '^expo-secure-store$': '<rootDir>/src/__tests__/mocks/expo-secure-store.ts',
    '^expo-constants$': '<rootDir>/src/__tests__/mocks/expo-constants.ts',
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  collectCoverageFrom: [
    // Business logic modules (focus of task-044)
    'src/services/timerService.ts',
    'src/utils/analytics.ts',
    'src/schemas/**/*.ts',
    // Exclude non-business-logic files
    '!src/**/*.d.ts',
    '!src/**/index.ts',
    '!src/**/__tests__/**',
  ],
  coverageThreshold: {
    // Per-file thresholds for business logic modules
    'src/schemas/**/*.ts': {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
    'src/utils/analytics.ts': {
      branches: 60,
      functions: 80,
      lines: 80,
      statements: 80,
    },
    'src/services/timerService.ts': {
      branches: 60,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
  transformIgnorePatterns: [
    'node_modules/(?!(expo-constants|expo-modules-core|expo-secure-store|expo-av|expo-linking|expo-web-browser|@expo)/)',
  ],
  globals: {
    __DEV__: true,
  },
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  clearMocks: true,
};
