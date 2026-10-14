/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/**/*.test.ts'],
  testPathIgnorePatterns: ['/node_modules/', '/frontend/'],
  clearMocks: true,
  setupFiles: ['<rootDir>/tests/setup-env.ts'],
  // First request in a suite pays for module init + a refused local Redis connect.
  testTimeout: 20000,
};
