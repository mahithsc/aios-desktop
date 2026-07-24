import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const DEFAULT_SERVER_URL = 'http://localhost:8765'
const serverUrl = (process.env.AIOS_SERVER_URL?.trim() || DEFAULT_SERVER_URL).replace(/\/$/, '')
const appConfigDefine = {
  __AIOS_SERVER_URL__: JSON.stringify(serverUrl)
}

export default defineConfig({
  main: {
    define: appConfigDefine
  },
  preload: {
    define: appConfigDefine
  },
  renderer: {
    define: appConfigDefine,
    resolve: {
      alias: {
        '@': resolve('src/renderer/src'),
        '@renderer': resolve('src/renderer/src'),
        '@shared': resolve('src/shared')
      }
    },
    plugins: [react(), tailwindcss()]
  }
})
