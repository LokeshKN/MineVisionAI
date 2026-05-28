import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/auth': 'http://localhost:8000',
      '/sites': 'http://localhost:8000',
      '/surveys': 'http://localhost:8000',
      '/reports': 'http://localhost:8000',
      '/uploads': 'http://localhost:8000',
    }
  }
})
