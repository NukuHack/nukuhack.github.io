import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { createHtmlPlugin } from 'vite-plugin-html'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(),
    createHtmlPlugin({
      template: 'vite_index.html', 
    })
  ],
})
