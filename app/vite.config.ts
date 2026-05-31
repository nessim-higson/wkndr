import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Base "/" suits Netlify/Vercel. The product app deploys separately from the
// /experiments design archive (which GitHub Pages serves at the repo root).
export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
})
