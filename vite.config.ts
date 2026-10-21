import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/rosie-reel-maker/',
  plugins: [react()],
  test: { environment: 'jsdom' },
})
