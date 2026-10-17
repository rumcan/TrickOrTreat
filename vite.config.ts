import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import { rundotGameLibrariesPlugin, rundotGamePlaygroundPlugin } from '@series-inc/rundot-game-sdk/vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vite.dev/config/
export default defineConfig({
  server: {
    // Listen on every interface, so phone-on-the-LAN and cloud preview proxies can reach the dev server.
    host: true,
    // Cloud previews (and anything tunnelling to a subdomain) are refused by Vite's default host check.
    allowedHosts: ['.e2b.app', '.arena.ai', 'localhost'],
    // Offline generation inputs/outputs and the nested session worktrees are not part of the running game; watching
    // them (tens of thousands of files) blocks the dev server before it answers its first request.
    watch: { ignored: ['art', 'output', 'dist', 'release-notes', '.codex-session', '.arcade-worktree', '.built-worktree'].map(d => path.resolve(__dirname, d).replace(/\\/g, '/') + '/**') },
  },
  build: {
    target: 'esnext',
  },
  base: './',
  plugins: [
    // rundot-import:vite-plugins:begin
    rundotGameLibrariesPlugin(),
    // Off for local play (the playground host needs a signed-in player); `RUNDOT_PLAYGROUND=1 npm run dev` brings it back.
    rundotGamePlaygroundPlugin({ target: 'playground', disabled: process.env.RUNDOT_PLAYGROUND !== '1' }),
    // rundot-import:vite-plugins:end
    react(), tailwindcss(), viteSingleFile(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
