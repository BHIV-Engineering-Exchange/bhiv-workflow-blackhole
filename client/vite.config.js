

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
// import tailwindcss from 'tailwindcss';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss(), VitePWA({
    registerType: 'autoUpdate',
    includeAssets: ['vite.svg'],
    workbox: {
      maximumFileSizeToCacheInBytes: 10 * 1024 * 1024 // 10 MB
    },
    manifest: {
      name: 'WorkflowAI Management App',
      short_name: 'WorkflowAI',
      description: 'Installable Fullstack App with React & Node.js',
      theme_color: '#ffffff',
      background_color: '#ffffff',
      display: 'standalone',
      start_url: '/',
      icons: [
        {
          src: 'vite.svg',
          sizes: '192x192',
          type: 'image/svg+xml'
        }
      ]
    }
  })],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
