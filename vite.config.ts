import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3001,
    proxy: {
      '/lazyapplyV2': {
        target: 'http://localhost:8200',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
