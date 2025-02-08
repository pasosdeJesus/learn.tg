import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import fs from 'fs'

import dotenv from "dotenv"
dotenv.config({path: "../servidor/.env"})

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
  ],
  server: {
    https: {
      key: fs.readFileSync(process.env.LLAVE_SSL),
      cert: fs.readFileSync(process.env.CERT_SSL),
    },
    port: 4300,
    host: "0.0.0.0",
  }
})
