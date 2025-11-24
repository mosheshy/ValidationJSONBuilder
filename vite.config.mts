
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

// Move Vite's cache out of OneDrive to avoid EPERM locks on rmdir.
const cacheDir = process.env.LOCALAPPDATA
  ? path.join(process.env.LOCALAPPDATA, 'validation-builder-vite-cache')
  : '.vite-cache'

export default defineConfig({
  cacheDir,
  plugins: [react()]
})
