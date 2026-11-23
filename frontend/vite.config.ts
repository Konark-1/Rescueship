import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vite.dev/config/
const hasPkg = (id: string, pkgs: string[]) =>
  pkgs.some((pkg) => id.includes(`/node_modules/${pkg}/`) || id.includes(`\\node_modules\\${pkg}\\`));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    // Allow Cloudflare quick-tunnel hostnames to reach the dev server
    allowedHosts: ['.trycloudflare.com'],
    watch: {
      ignored: ['**/playwright-report/**', '**/test-results/**', '**/.git/**'],
    },
    proxy: {
      '/api': {
        target: process.env.VITE_BACKEND_URL || 'https://rescueship.onrender.com',
        changeOrigin: true,
      },
      '/webhooks': {
        target: process.env.VITE_BACKEND_URL || 'https://rescueship.onrender.com',
        changeOrigin: true,
      },
    },
  },
  build: {
    target: 'es2022',
    cssCodeSplit: true,
    modulePreload: {
      // Hard gate: Never preload Three.js or Charts on the initial entry
      resolveDependencies: (_filename, deps) =>
        deps.filter((dep) => !dep.includes('vendor-charts') && !dep.includes('vendor-three') && !dep.includes('experience')),
    },
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return undefined;

          // 1. Core React runtime
          if (hasPkg(id, ['react', 'react-dom', 'scheduler', 'use-sync-external-store', 'zustand'])) {
            return 'vendor-react';
          }

          // 2. Three.js (Strictly isolated)
          if (hasPkg(id, ['three', '@react-three'])) {
            return 'vendor-three';
          }

          // 3. Router runtime
          if (hasPkg(id, ['react-router', 'react-router-dom', '@remix-run/router'])) {
            return 'vendor-router';
          }
        },
      },
    },
  },
})
