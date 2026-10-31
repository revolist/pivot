import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import angular from '@analogjs/vite-plugin-angular';
import react from '@vitejs/plugin-react';
import vue from '@vitejs/plugin-vue';
import { trialFilterIdentityPlugin } from './scripts/trial-filter-identity.mjs';
import { resolvePivotVersion } from './scripts/pivot-version.mjs';

export default defineConfig(({ mode }) => ({
  base: './',
  define: mode === 'test' ? {} : {
    'import.meta.env.REVOGRID_PIVOT_VERSION': JSON.stringify(resolvePivotVersion(import.meta.url)),
  },
  optimizeDeps: { exclude: ['@revolist/revogrid-pro', '@revolist/pivot'] },
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        charts: fileURLToPath(new URL('./charts.html', import.meta.url)),
        financial: fileURLToPath(new URL('./financial.html', import.meta.url)),
      },
    },
  },
  resolve: {
    alias: {
      './pivot-entry': fileURLToPath(
        new URL(
          mode === 'react'
            ? './src/pivot-entry.react.tsx'
            : mode === 'vue'
              ? './src/pivot-entry.vue.ts'
              : mode === 'angular'
                ? './src/pivot-entry.angular.ts'
                : './src/pivot-entry.ts',
          import.meta.url,
        ),
      ),
      ...(mode === 'test'
        ? {
            '@revolist/revogrid-column-date': fileURLToPath(
              new URL('./tests/revogrid-column-date.stub.ts', import.meta.url),
            ),
          }
        : {}),
    },
    ...(mode === 'angular' ? { mainFields: ['module'] } : {}),
  },
  plugins: [
    trialFilterIdentityPlugin(),
    ...(mode === 'angular' ? [angular()] : []),
    react(),
    vue({ template: { compilerOptions: { isCustomElement: (tag) => tag.startsWith('revo-') || tag.startsWith('revogr-') || tag.startsWith('financial-') } } }),
  ],
  test: {
    environment: 'jsdom',
    include: ['tests/unit/**/*.test.ts'],
    exclude: ['tests/e2e/**'],
    server: { deps: { inline: true } },
  },
}));
