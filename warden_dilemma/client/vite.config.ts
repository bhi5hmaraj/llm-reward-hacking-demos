import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/warden_dilemma',  // Serve app under /warden_dilemma subpath
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      // Proxy API requests to backend
      '/warden_dilemma/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})
