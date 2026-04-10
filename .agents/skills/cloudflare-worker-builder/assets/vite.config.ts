import { cloudflare } from '@cloudflare/vite-plugin'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [
    cloudflare({
      // Optional: Configure the plugin if needed
      // See: https://developers.cloudflare.com/workers/vite-plugin/
    }),
  ],
})
