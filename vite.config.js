import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000, // Aqui você define a porta que quiser
    open: true  // Isso abre o navegador automaticamente
  }
})