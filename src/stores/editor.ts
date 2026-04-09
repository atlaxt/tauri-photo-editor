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

export const useEditorStore = defineStore('editor', () => {
  // Açık dosya
  const filePath = ref<string | null>(null)
  const fileName = computed(() =>
    filePath.value ? filePath.value.split(/[\\/]/).pop() ?? null : null,
  )

  // Uygulanan işlemler (mevcut durum)
  const operations = ref<Operation[]>([])

  // Geri al / ileri al geçmişi
  const history = ref<HistoryEntry[]>([])
  const historyIndex = ref(-1)

  const canUndo = computed(() => historyIndex.value > 0)
  const canRedo = computed(() => historyIndex.value < history.value.length - 1)

  function openFile(path: string) {
    filePath.value = path
    operations.value = []
    history.value = [{ operations: [], label: 'Açıldı' }]
    historyIndex.value = 0
  }

  function addOperation(op: Operation, label: string) {
    // İleri geçmişi sil (yeni işlem yapılınca redo geçersiz olur)
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

  function reset() {
    filePath.value = null
    operations.value = []
    history.value = []
    historyIndex.value = -1
  }

  return {
    filePath,
    fileName,
    operations,
    history,
    historyIndex,
    canUndo,
    canRedo,
    openFile,
    addOperation,
    undo,
    redo,
    reset,
  }
})
