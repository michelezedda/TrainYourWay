import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    open: true,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return
          if (id.includes('framer-motion')) return 'vendor-motion'
          if (id.includes('@instantdb')) return 'vendor-db'
          if (id.includes('@google/generative-ai') || id.includes('groq-sdk')) return 'vendor-ai'
          if (id.includes('react-dom') || id.includes('react-router') || id.includes('/react/')) return 'vendor-react'
        },
      },
    },
  },
})
