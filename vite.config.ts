import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), VitePWA({ registerType: 'autoUpdate', manifest: { name: 'Storyteller', short_name: 'Storyteller', description: 'Event production workflow management', theme_color: '#173f5f', background_color: '#f6f8f7', display: 'standalone', icons: [] } })],
})
