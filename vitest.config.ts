import { defineConfig } from 'vitest/config';

// Heavy fast-check properties run 2-3x slower under parallel load than alone (~1.8s vs ~4.7s).
const testTimeout = 30_000;

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'domain',
          root: 'packages/domain',
          environment: 'node',
          testTimeout,
          include: ['src/**/*.test.ts'],
        },
      },
      {
        test: {
          name: 'ai-core',
          root: 'packages/ai-core',
          environment: 'node',
          testTimeout,
          include: ['src/**/*.test.ts'],
        },
      },
      {
        test: {
          name: 'spike-providers',
          root: 'spikes/providers',
          environment: 'node',
          testTimeout,
          include: ['src/**/*.test.ts'],
        },
      },
      {
        test: {
          name: 'spike-mcp-bridge',
          root: 'spikes/mcp-bridge',
          environment: 'node',
          testTimeout,
          include: ['src/**/*.test.ts'],
        },
      },
      {
        test: {
          name: 'project-format',
          root: 'packages/project-format',
          environment: 'node',
          testTimeout,
          include: ['src/**/*.test.ts'],
        },
      },
      {
        test: {
          name: 'storage',
          root: 'packages/storage',
          environment: 'node',
          testTimeout,
          include: ['src/**/*.test.ts'],
        },
      },
      'apps/web/vite.config.ts',
    ],
  },
});
