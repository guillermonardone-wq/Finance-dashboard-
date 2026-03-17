import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.js'],
    exclude: ['tests/providers.test.js'],
    testTimeout: 15000,
    pool: 'forks',
  },
});
