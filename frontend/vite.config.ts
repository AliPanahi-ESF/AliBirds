import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

function versionPlugin() {
  return {
    name: 'generate-version-json',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify({
          buildTime: Date.now(),
          version: '1.0.' + Math.floor(Date.now() / 1000),
        }),
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), versionPlugin()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 3000,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom')) {
              return 'vendor-react'
            }
            if (id.includes('@tanstack/react-query')) {
              return 'vendor-query'
            }
            if (id.includes('@supabase')) {
              return 'vendor-supabase'
            }
            if (id.includes('lucide-react')) {
              return 'vendor-lucide'
            }
            if (id.includes('jspdf')) {
              return 'vendor-jspdf'
            }
            if (id.includes('html2canvas')) {
              return 'vendor-html2canvas'
            }
            if (id.includes('dompurify')) {
              return 'vendor-dompurify'
            }
            if (id.includes('pdfjs-dist')) {
              return 'vendor-pdfjs'
            }
          }
        },
      },
    },
  },
})
