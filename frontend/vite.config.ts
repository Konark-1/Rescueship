import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
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
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('recharts')) {
            return 'vendor-recharts';
          }
          if (id.includes('motion')) {
            return 'vendor-motion';
          }
          if (id.includes('lucide-react')) {
            return 'vendor-lucide';
          }
          if (id.includes('react-router')) {
            return 'vendor-router';
          }
        },
      },
    },
  },
})
