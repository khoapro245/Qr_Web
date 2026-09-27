import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// The SPA calls the API on the same origin (/api). In development Vite proxies it to the
// backend so cookies behave exactly as they will behind the production reverse proxy.
const apiProxy = {
  '/api': { target: process.env.VITE_API_PROXY_TARGET ?? 'http://127.0.0.1:4000' },
};

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5173, strictPort: true, proxy: apiProxy },
  preview: { port: 4173, strictPort: true, proxy: apiProxy },
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    testTimeout: 15_000,
    include: ['tests/**/*.test.{ts,tsx}'],
  },
});
