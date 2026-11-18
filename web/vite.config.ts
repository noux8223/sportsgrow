import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const apiTarget = process.env.SPORTSGROW_API_TARGET ?? 'http://127.0.0.1:3000'

const apiProxy = {
  '/api': {
    target: apiTarget,
    changeOrigin: false,
  },
}

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: apiProxy,
  },
  preview: {
    port: 4173,
    proxy: apiProxy,
  },
})
