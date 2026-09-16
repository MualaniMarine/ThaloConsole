import { defineConfig } from 'vite'
import { resolve } from 'node:path'
export default defineConfig({
  base: './',
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        deviceStatus: resolve(import.meta.dirname, 'device-status.html'),
      },
    },
  },
})
