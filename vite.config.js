import { defineConfig } from 'vite'

export default defineConfig({
  base: '/web-loudness-meter/',
  server: {
    host: true,
  },
  build: {
    target: 'es2020',
    assetsInlineLimit: 0,
  },
})
