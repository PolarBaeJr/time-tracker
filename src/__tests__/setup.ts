/**
 * Jest Test Setup
 *
 * This file runs before each test file and sets up the test environment.
 */

// Set timezone for consistent date tests
process.env.TZ = 'UTC';

// Provide required env vars so Supabase client can be instantiated in tests
process.env.EXPO_PUBLIC_SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'https://test.supabase.co';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? 'test-anon-key';

// Mock console.warn to avoid noisy test output
const originalWarn = console.warn;
console.warn = (...args: unknown[]) => {
  // Filter out expected warnings during tests
  const message = args[0];
  if (typeof message === 'string') {
    // Skip Zod validation warnings in tests
    if (message.includes('Invalid timer data from server')) {
      return;
    }
    if (message.includes('Invalid time entry data from server')) {
      return;
    }
  }
  originalWarn.apply(console, args);
};

// Restore console.warn after all tests
afterAll(() => {
  console.warn = originalWarn;
});
