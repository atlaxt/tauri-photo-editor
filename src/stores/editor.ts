import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

export type OperationType
  = | 'crop'
    | 'rotate'
    | 'flip_horizontal'
    | 'flip_vertical'
    | 'brightness'
    | 'contrast'
    | 'saturation'
    | 'sharpen'
    | 'grayscale'
    | 'resize'
    | 'output'

export interface Operation {
  op: OperationType
  params: Record<string, unknown>
}

export interface HistoryEntry {
  operations: Operation[]
  label: string
}

export interface Layer {
  id: string
  name: string
  opacity: number // 0–100
  visible: boolean
  rotation: number // derece
}

export const useEditorStore = defineStore('editor', () => {
  const filePath = ref<string | null>(null)
  const objectUrl = ref<string | null>(null)
  const fileName = computed(() =>
    filePath.value ? filePath.value.split(/[\\/]/).pop() ?? null : null,
  )

  const operations = ref<Operation[]>([])

  const history = ref<HistoryEntry[]>([])
  const historyIndex = ref(-1)

  const canUndo = computed(() => historyIndex.value > 0)
  const canRedo = computed(() => historyIndex.value < history.value.length - 1)

  // Katmanlar — Faz 1: tek temel katman
  const layers = ref<Layer[]>([])

  function revokeObjectUrl() {
    if (objectUrl.value) {
      URL.revokeObjectURL(objectUrl.value)
      objectUrl.value = null
    }
  }

  function openFile(path: string, baseName?: string) {
    if (path !== objectUrl.value)
      revokeObjectUrl()

    if (path.startsWith('blob:'))
      objectUrl.value = path

    filePath.value = path
    operations.value = []
    history.value = [{ operations: [], label: 'opened' }]
    historyIndex.value = 0
    const rawName = baseName ?? (path.split(/[\\/]/).pop() ?? 'Katman 1')
    const nameWithoutExt = rawName.replace(/\.[^.]+$/, '')
    layers.value = [{
      id: 'base',
      name: nameWithoutExt,
      opacity: 100,
      visible: true,
      rotation: 0,
    }]
  }

  function updateLayer(id: string, patch: Partial<Omit<Layer, 'id'>>) {
    const layer = layers.value.find(l => l.id === id)
    if (layer)
      Object.assign(layer, patch)
  }

  function addOperation(op: Operation, label: string) {
    history.value = history.value.slice(0, historyIndex.value + 1)
    operations.value = [...operations.value, op]
    history.value.push({ operations: [...operations.value], label })
    historyIndex.value++
  }

  function undo() {
    if (!canUndo.value)
      return
    historyIndex.value--
    operations.value = [...history.value[historyIndex.value].operations]
  }

  function redo() {
    if (!canRedo.value)
      return
    historyIndex.value++
    operations.value = [...history.value[historyIndex.value].operations]
  }

  function jumpTo(index: number) {
    if (index < 0 || index >= history.value.length)
      return
    historyIndex.value = index
    operations.value = [...history.value[index].operations]
  }

  function reset() {
    revokeObjectUrl()
    filePath.value = null
    operations.value = []
    history.value = []
    historyIndex.value = -1
    layers.value = []
  }

  return {
    filePath,
    fileName,
    operations,
    history,
    historyIndex,
    canUndo,
    canRedo,
    layers,
    openFile,
    updateLayer,
    addOperation,
    undo,
    redo,
    jumpTo,
    reset,
  }
})
