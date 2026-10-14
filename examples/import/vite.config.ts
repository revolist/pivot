import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
export default defineConfig({
  base: './', cacheDir: '.vite',
  worker: { format: 'es' },
  plugins: [vue({ template: { compilerOptions: { isCustomElement: tag => tag.startsWith('revo-') || tag.startsWith('revogr-') } } })],
  test: { environment: 'jsdom', include: ['tests/*.test.ts'], server: { deps: { inline: true } } },
});
