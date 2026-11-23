import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // es2022: src/firebase.ts awaits the hosting config at load time.
  build: { target: 'es2022' },
})
