import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
    server: {
    port: 5173,
    strictPort: true // fail if port is taken instead of switching
  }
});