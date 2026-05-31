import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// On GitHub Pages the app is served under /wkndr/ ; keep local dev at /.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/wkndr/' : '/',
  plugins: [react()],
  server: { port: 5173 },
}))
