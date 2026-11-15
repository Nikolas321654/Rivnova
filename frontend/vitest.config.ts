import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';

export default defineConfig((configEnv) =>
  mergeConfig(viteConfig(configEnv), {
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/shared/lib/testing/setup.ts'],
      css: false,
      restoreMocks: true,
    },
  }),
);
