import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  base: './',
  cacheDir: './.vite',
  build: {
    rollupOptions: {
      input: {
        client: fileURLToPath(new URL('./index.html', import.meta.url)),
      },
    },
  },
});
