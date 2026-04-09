import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

export type BatchStatus = 'idle' | 'running' | 'done' | 'error'

export interface BatchLogEntry {
  file: string
  status: 'ok' | 'error'
  message?: string
}

export const useBatchStore = defineStore('batch', () => {
  const sourceDir = ref<string | null>(null)
  const destDir = ref<string | null>(null)
  const presetId = ref<string | null>(null)

  const status = ref<BatchStatus>('idle')
  const total = ref(0)
  const current = ref(0)
  const log = ref<BatchLogEntry[]>([])

  const progress = computed(() =>
    total.value > 0 ? Math.round((current.value / total.value) * 100) : 0,
  )
  const isRunning = computed(() => status.value === 'running')

  function reset() {
    status.value = 'idle'
    total.value = 0
    current.value = 0
    log.value = []
  }

  // Tauri event'inden çağrılacak (start_batch komutu emit eder)
  function onProgress(payload: { current: number, total: number, file: string, error?: string }) {
    current.value = payload.current
    total.value = payload.total
    log.value.push({
      file: payload.file,
      status: payload.error ? 'error' : 'ok',
      message: payload.error,
    })
    if (payload.current >= payload.total)
      status.value = 'done'
  }

  async function start() {
    if (!sourceDir.value || !destDir.value || !presetId.value)
      return
    reset()
    status.value = 'running'
    // Görev #7'de Tauri invoke + event listener eklenecek
    // const { invoke } = await import('@tauri-apps/api/core')
    // await invoke('start_batch', { sourceDir: sourceDir.value, destDir: destDir.value, presetId: presetId.value })
  }

  return {
    sourceDir,
    destDir,
    presetId,
    status,
    total,
    current,
    progress,
    log,
    isRunning,
    reset,
    onProgress,
    start,
  }
})
