/**
 * Global setup for integration tests.
 * Runs once before all integration test suites.
 * Verifies DATABASE_URL is set (should point to a test database).
 */
export default function globalSetup() {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      'DATABASE_URL must be set for integration tests. ' +
      'Use a dedicated test database to avoid data loss.',
    );
  }
}
