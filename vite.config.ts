import {defineConfig} from 'vite';
import {hydrogen} from '@shopify/hydrogen/vite';
import {oxygen} from '@shopify/mini-oxygen/vite';
import {reactRouter} from '@react-router/dev/vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import {
  heroStudioExcludePlugin,
  studioPlugin,
} from './studio/vite-plugin-studio';

export default defineConfig({
  plugins: [
    // MUST stay ahead of oxygen(). Both register `configureServer` with
    // `order: 'pre'`, and Vite keeps registration order inside a bucket, so
    // this is what lets the studio's write endpoint be answered by real Node
    // instead of being proxied into the filesystem-less Workerd sandbox.
    // It is `apply: 'serve'`, so it does not exist in a production build.
    studioPlugin(),
    // Strips the hero tuning tool out of the production client build; it sits
    // in publicDir, so Vite would otherwise serve it at a public URL.
    heroStudioExcludePlugin(),
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
        // Subagent worktrees live under .claude/worktrees inside the repo;
        // their branch churn (tsconfig writes force full reloads) storms the
        // watcher and has crashed the dev server. Never watch them.
        '**/.claude/**',
      ],
    },
  },
});
