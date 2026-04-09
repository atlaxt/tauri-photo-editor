import process from 'node:process'
import ui from '@nuxt/ui/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

const host = process.env.TAURI_DEV_HOST

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [
    vue(),
    ui({
      ui: {
        colors: {
          primary: 'blue',
          neutral: 'neutral',
        },
        icons: {
          arrowDown: 'i-ph-arrow-down',
          arrowLeft: 'i-ph-arrow-left',
          arrowRight: 'i-ph-arrow-right',
          arrowUp: 'i-ph-arrow-up',
          caution: 'i-ph-warning-circle',
          check: 'i-ph-check',
          chevronDoubleLeft: 'i-ph-caret-double-left',
          chevronDoubleRight: 'i-ph-caret-double-right',
          chevronDown: 'i-ph-caret-down',
          chevronLeft: 'i-ph-caret-left',
          chevronRight: 'i-ph-caret-right',
          chevronUp: 'i-ph-caret-up',
          close: 'i-ph-x',
          copy: 'i-ph-copy',
          copyCheck: 'i-ph-check-circle',
          dark: 'i-ph-moon',
          drag: 'i-ph-dots-six-vertical',
          ellipsis: 'i-ph-dots-three',
          error: 'i-ph-x-circle',
          external: 'i-ph-arrow-up-right',
          eye: 'i-ph-eye',
          eyeOff: 'i-ph-eye-slash',
          file: 'i-ph-file',
          folder: 'i-ph-folder',
          folderOpen: 'i-ph-folder-open',
          hash: 'i-ph-hash',
          info: 'i-ph-info',
          light: 'i-ph-sun',
          loading: 'i-ph-circle-notch',
          menu: 'i-ph-list',
          minus: 'i-ph-minus',
          panelClose: 'i-ph-caret-left',
          panelOpen: 'i-ph-caret-right',
          plus: 'i-ph-plus',
          reload: 'i-ph-arrow-counter-clockwise',
          search: 'i-ph-magnifying-glass',
          stop: 'i-ph-square',
          success: 'i-ph-check-circle',
          system: 'i-ph-monitor',
          tip: 'i-ph-lightbulb',
          upload: 'i-ph-upload',
          warning: 'i-ph-warning',
        },
      },
    }),
  ],

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: 'ws',
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ['**/src-tauri/**'],
    },
  },
}))
