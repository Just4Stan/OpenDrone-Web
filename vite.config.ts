import {defineConfig} from 'vite';
import {hydrogen} from '@shopify/hydrogen/vite';
import {oxygen} from '@shopify/mini-oxygen/vite';
import {reactRouter} from '@react-router/dev/vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  plugins: [
    tailwindcss(),
    hydrogen(),
    oxygen(),
    reactRouter(),
    tsconfigPaths(),
  ],
  resolve: {
    alias: {
      // Fix broken pnpm paths in @shopify/hydrogen-react@2026.1.1
      '@xstate/react/lib/fsm': path.resolve(
        'node_modules/@shopify/hydrogen-react/node_modules/@xstate/react/lib/fsm.js',
      ),
      '@xstate/fsm': path.resolve('node_modules/@xstate/fsm/lib/index.js'),
    },
  },
  build: {
    // Allow a strict Content-Security-Policy
    // without inlining assets as base64:
    assetsInlineLimit: 0,
  },
  ssr: {
    optimizeDeps: {
      include: [
        'use-sync-external-store/shim/with-selector',
        '@xstate/fsm',
        'set-cookie-parser',
        'cookie',
        'react-router',
      ],
    },
  },
  server: {
    allowedHosts: ['.tryhydrogen.dev'],
    watch: {
      // iCloud Drive constantly touches mtime on the synced legal
      // markdown snapshots which makes Vite's file watcher reload the
      // page every few seconds. Those files only change via
      // `npm run sync:legal` which is run manually, so it's safe to
      // ignore them for HMR. Same story for the tsc incremental build
      // info file rewritten on every typegen pass.
      ignored: [
        '**/app/content/legal/**',
        '**/tsconfig.tsbuildinfo',
        '**/.DS_Store',
        '**/.icloud',
      ],
    },
  },
});
