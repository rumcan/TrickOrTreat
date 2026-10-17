import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const root = path.dirname(fileURLToPath(import.meta.url));

// Local play uses the SDK's browser mock without the RUN hosting middleware.
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(root, 'src') } },
  optimizeDeps: { entries: ['index.html'] },
  server: {
    host: '0.0.0.0', port: 5173, strictPort: true,
    watch: {
      ignored: ['art', 'output', 'dist', 'release-notes', '.codex-session', '.arcade-worktree', '.built-worktree']
        .map(directory => path.resolve(root, directory).replace(/\\/g, '/') + '/**'),
    },
  },
});
