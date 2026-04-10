import type { UnlistenFn } from '@tauri-apps/api/event'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { usePresetStore } from './presets'

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

  let _unlisten: UnlistenFn | null = null

  function reset() {
    status.value = 'idle'
    total.value = 0
    current.value = 0
    log.value = []
  }

  async function start() {
    if (!sourceDir.value || !destDir.value || !presetId.value)
      return

    const presetStore = usePresetStore()
    const preset = presetStore.presets.find(p => p.id === presetId.value)
    if (!preset)
      return

    reset()
    status.value = 'running'

    _unlisten = await listen<{ current: number, total: number, fileName: string, error?: string }>(
      'batch://progress',
      (event) => {
        const { current: c, total: t, fileName, error } = event.payload
        current.value = c
        total.value = t
        log.value.push({ file: fileName, status: error ? 'error' : 'ok', message: error })
        if (c >= t)
          status.value = 'done'
      },
    )

    try {
      await invoke('start_batch', {
        sourceDir: sourceDir.value,
        destDir: destDir.value,
        ops: preset.steps,
      })
    }
    catch (e) {
      status.value = 'error'
      log.value.push({ file: '—', status: 'error', message: String(e) })
    }
    finally {
      _unlisten?.()
      _unlisten = null
    }
  }

  function cancel() {
    _unlisten?.()
    _unlisten = null
    if (status.value === 'running')
      status.value = 'idle'
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
    start,
    cancel,
  }
})
