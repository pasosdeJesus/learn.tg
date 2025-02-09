import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
  ],
  build: {
    minify: false,
    terserOptions: {
      compress: false,
      mangle: false,
    },
  },
  server: {
    hmr: false,
    https: {
      key: "../.cert/llave.pem",
      cert: "../.cert/cert.pem",
    },
    port: 4300,
    host: "0.0.0.0",
  }
})
