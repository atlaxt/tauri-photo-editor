import type { Operation } from './editor'
import { invoke } from '@tauri-apps/api/core'
import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface Preset {
  id: string
  name: string
  description?: string
  steps: Operation[]
  createdAt: string
  updatedAt: string
}

export const usePresetStore = defineStore('presets', () => {
  const presets = ref<Preset[]>([])
  const isLoading = ref(false)

  async function load() {
    isLoading.value = true
    try {
      presets.value = await invoke<Preset[]>('list_presets')
    }
    finally {
      isLoading.value = false
    }
  }

  async function save(preset: Preset): Promise<Preset> {
    const saved = await invoke<Preset>('save_preset', { preset })
    const idx = presets.value.findIndex(p => p.id === saved.id)
    if (idx >= 0)
      presets.value[idx] = saved
    else
      presets.value.push(saved)
    return saved
  }

  async function remove(id: string) {
    await invoke('delete_preset', { id })
    presets.value = presets.value.filter(p => p.id !== id)
  }

  return { presets, isLoading, load, save, remove }
})
