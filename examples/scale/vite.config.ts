import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  cacheDir: './.vite',
  server: {
    proxy: { '/api/pivot': 'http://127.0.0.1:4174', '/api/health': 'http://127.0.0.1:4174' },
  },
});
