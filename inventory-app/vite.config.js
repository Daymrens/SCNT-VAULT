import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

function historyApiFallback() {
  return {
    name: 'history-api-fallback',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.startsWith('/inventory/') && !req.url.includes('.') && !req.url.startsWith('/inventory/@')) {
          req.url = '/inventory/index.html'
        }
        next()
      })
    }
  }
}

export default defineConfig({
  plugins: [react(), historyApiFallback()],
  base: '/inventory/',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    target: 'es2020',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('jspdf') || id.includes('html2canvas') || id.includes('purify')) return 'pdf'
          if (id.includes('html5-qrcode')) return 'qr'
          if (id.includes('recharts') || id.includes('/d3-')) return 'charts'
          if (id.includes('firebase') || id.includes('@firebase')) return 'firebase'
          return 'vendor'
        },
      },
    },
  },
  server: {
    port: 3000,
    open: true
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
    css: true,
  }
})
