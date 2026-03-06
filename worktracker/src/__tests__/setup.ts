/**
 * Jest Test Setup
 *
 * This file runs before each test file and sets up the test environment.
 */

// Set timezone for consistent date tests
process.env.TZ = 'UTC';

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
