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
        tsconfig: 'tsconfig.json',
      },
    ],
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    // Mock React Native modules
    '^react-native$': '<rootDir>/src/__tests__/mocks/react-native.ts',
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/index.ts',
    '!src/**/__tests__/**',
    '!src/components/**', // Skip UI components for now (covered by component tests in task-046)
    '!src/screens/**', // Skip screens (covered by component tests)
    '!src/navigation/**', // Skip navigation
    '!src/contexts/**', // Skip contexts (requires React rendering)
    '!src/hooks/**', // Skip hooks (requires React rendering)
    '!src/lib/supabase*.ts', // Skip Supabase client files (platform-specific)
    '!src/lib/realtime.ts', // Skip realtime (requires Supabase)
    '!src/lib/linking.ts', // Skip linking (requires React Navigation)
    '!src/lib/storage/**', // Skip storage (platform-specific)
  ],
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 60,
      lines: 60,
      statements: 60,
    },
  },
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  clearMocks: true,
};
