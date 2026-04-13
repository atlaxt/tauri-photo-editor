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

export type LayerType = 'base' | 'image'
export type BlendMode = 'normal'

export interface Layer {
  id: string
  type: LayerType
  name: string
  opacity: number // 0–100
  visible: boolean
  blendMode: BlendMode
  rotation: number // derece
  x: number
  y: number
  width: number
  height: number
  backgroundColor: string | null
  imageSrc: string | null
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
      type: 'base',
      name,
      opacity: 100,
      visible: true,
      blendMode: 'normal',
      rotation: 0,
      x: 0,
      y: 0,
      width: 1,
      height: 1,
      backgroundColor: '#ffffff',
      imageSrc: null,
    }
  }

  function revokeObjectUrl() {
    if (objectUrl.value) {
      URL.revokeObjectURL(objectUrl.value)
      objectUrl.value = null
    }
  }

  async function openFile(path: string, baseName?: string) {
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
    const base = createBaseLayer(nameWithoutExt)

    // Resolve the image URL for the canvas to draw
    try {
      const { convertFileSrc } = await import('@tauri-apps/api/core')
      base.imageSrc = convertFileSrc(path)
    }
    catch {
      base.imageSrc = path
    }

    layers.value = [base]
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
    const base = createBaseLayer('Arkaplan')
    base.width = canvasWidth.value
    base.height = canvasHeight.value
    layers.value = [base]
    selectedLayerId.value = 'base'
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

  function updateLayer(id: string, patch: Partial<Omit<Layer, 'id' | 'type'>>) {
    const layer = layers.value.find(l => l.id === id)
    if (layer)
      Object.assign(layer, patch)
  }

  function addImageLayer(src: string, name: string, naturalW: number, naturalH: number): string {
    const id = crypto.randomUUID()
    const cw = canvasWidth.value ?? naturalW
    const ch = canvasHeight.value ?? naturalH
    const layer: Layer = {
      id,
      type: 'image',
      name,
      opacity: 100,
      visible: true,
      blendMode: 'normal',
      rotation: 0,
      x: Math.round((cw - naturalW) / 2),
      y: Math.round((ch - naturalH) / 2),
      width: naturalW,
      height: naturalH,
      backgroundColor: null,
      imageSrc: src,
    }
    layers.value.push(layer)
    selectedLayerId.value = id
    return id
  }

  function removeLayer(id: string) {
    const layer = layers.value.find(l => l.id === id)
    if (!layer || layer.type === 'base')
      return
    const idx = layers.value.indexOf(layer)
    layers.value.splice(idx, 1)
    if (selectedLayerId.value === id)
      selectedLayerId.value = 'base'
  }

  function moveLayerUp(id: string) {
    const idx = layers.value.findIndex(l => l.id === id)
    if (idx <= 0 || idx >= layers.value.length - 1)
      return
    // Cannot move base (idx 0). Swap idx with idx+1.
    const tmp = layers.value[idx + 1]
    layers.value[idx + 1] = layers.value[idx]
    layers.value[idx] = tmp
  }

  function moveLayerDown(id: string) {
    const idx = layers.value.findIndex(l => l.id === id)
    // Cannot go below index 1 (base is at 0)
    if (idx <= 1)
      return
    const tmp = layers.value[idx - 1]
    layers.value[idx - 1] = layers.value[idx]
    layers.value[idx] = tmp
  }

  function reorderLayer(id: string, targetId: string, insertAfter: boolean) {
    if (id === targetId)
      return
    const fromIdx = layers.value.findIndex(l => l.id === id)
    if (fromIdx <= 0)
      return // base cannot be moved
    const layer = layers.value[fromIdx]
    layers.value.splice(fromIdx, 1)
    let toIdx = layers.value.findIndex(l => l.id === targetId)
    if (toIdx === -1) {
      layers.value.splice(fromIdx, 0, layer)
      return
    }
    if (insertAfter)
      toIdx++
    toIdx = Math.max(1, toIdx) // cannot go below base
    layers.value.splice(toIdx, 0, layer)
  }

  function duplicateLayer(id: string) {
    const layer = layers.value.find(l => l.id === id)
    if (!layer)
      return
    const copy: Layer = {
      ...layer,
      id: crypto.randomUUID(),
      name: `${layer.name} kopya`,
    }
    const idx = layers.value.indexOf(layer)
    layers.value.splice(idx + 1, 0, copy)
    selectedLayerId.value = copy.id
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
    addImageLayer,
    removeLayer,
    moveLayerUp,
    moveLayerDown,
    reorderLayer,
    duplicateLayer,
    addOperation,
    undo,
    redo,
    jumpTo,
    reset,
  }
})
