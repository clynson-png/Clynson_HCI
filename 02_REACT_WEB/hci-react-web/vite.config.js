import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/trello': {
        target: `http://localhost:${process.env.ADMIN_BACKEND_PORT || 8787}`,
        changeOrigin: true,
      },
      '/api/plan': {
        target: `http://localhost:${process.env.ADMIN_BACKEND_PORT || 8787}`,
        changeOrigin: true,
      },
    },
  },
})
