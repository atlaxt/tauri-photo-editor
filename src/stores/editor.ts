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
  x: number
  y: number
  width: number
  height: number
}

export const useEditorStore = defineStore('editor', () => {
  const filePath = ref<string | null>(null)
  const objectUrl = ref<string | null>(null)
  const canvasWidth = ref<number | null>(null)
  const canvasHeight = ref<number | null>(null)
  const selectedLayerId = ref<string | null>(null)
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
  const selectedLayer = computed(() =>
    layers.value.find(l => l.id === selectedLayerId.value) ?? null,
  )
  const hasProject = computed(() =>
    !!(canvasWidth.value && canvasHeight.value),
  )

  function createBaseLayer(name: string): Layer {
    return {
      id: 'base',
      name,
      opacity: 100,
      visible: true,
      rotation: 0,
      x: 0,
      y: 0,
      width: 1,
      height: 1,
    }
  }

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
    layers.value = [createBaseLayer(nameWithoutExt)]
    selectedLayerId.value = 'base'
    canvasWidth.value = null
    canvasHeight.value = null
  }

  function createBlankProject(width: number, height: number) {
    revokeObjectUrl()
    filePath.value = null
    operations.value = []
    history.value = [{ operations: [], label: 'opened' }]
    historyIndex.value = 0
    canvasWidth.value = Math.max(1, Math.round(width))
    canvasHeight.value = Math.max(1, Math.round(height))
    layers.value = []
    selectedLayerId.value = null
  }

  function initBaseLayerFromImage(width: number, height: number) {
    const layer = layers.value.find(l => l.id === 'base')
    if (!layer)
      return
    layer.width = Math.max(1, Math.round(width))
    layer.height = Math.max(1, Math.round(height))
    layer.x = 0
    layer.y = 0
    if (!canvasWidth.value || !canvasHeight.value) {
      canvasWidth.value = layer.width
      canvasHeight.value = layer.height
    }
  }

  function setCanvasSize(width: number, height: number) {
    canvasWidth.value = Math.max(1, Math.round(width))
    canvasHeight.value = Math.max(1, Math.round(height))
  }

  function selectLayer(id: string | null) {
    selectedLayerId.value = id
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
    canvasWidth.value = null
    canvasHeight.value = null
    operations.value = []
    history.value = []
    historyIndex.value = -1
    layers.value = []
    selectedLayerId.value = null
  }

  return {
    filePath,
    fileName,
    canvasWidth,
    canvasHeight,
    operations,
    history,
    historyIndex,
    canUndo,
    canRedo,
    layers,
    selectedLayer,
    selectedLayerId,
    hasProject,
    openFile,
    createBlankProject,
    initBaseLayerFromImage,
    setCanvasSize,
    selectLayer,
    updateLayer,
    addOperation,
    undo,
    redo,
    jumpTo,
    reset,
  }
})
