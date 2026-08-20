import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html', 'json-summary'],
      reportsDirectory: './coverage',
      // Business logic that must stay green on every PR.
      // Electron shell (index), preload bridge, and React UI are excluded.
      include: [
        'src/main/crypto/**/*.ts',
        'src/main/sync/**/*.ts',
        'src/main/storage/simpleStore.ts',
        'src/main/storage/fileProvider.ts',
        'src/main/storage/mongoProvider.ts',
        'src/main/windowLayout.ts'
      ],
      exclude: ['**/*.test.ts', 'src/main/storage/provider.ts'],
      thresholds: {
        lines: 100,
        functions: 100,
        branches: 100,
        statements: 100
      }
    }
  },
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'shared')
    }
  }
})
