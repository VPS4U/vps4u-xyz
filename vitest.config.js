import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.{js,jsx}'],
    setupFiles: ['./tests/setup.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['lib/**/*.js', 'api/**/*.js'],
      thresholds: {
        // Domyślne minimum dla helperów (lib/). Endpointy (api/) testowane integracyjnie.
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
      },
    },
  },
});
