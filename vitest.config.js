import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'jsdom',
    include: ['tests/vue/**/*.test.js'],
    setupFiles: ['tests/vue/setup.js'],
    clearMocks: true,
    restoreMocks: true
  }
});
