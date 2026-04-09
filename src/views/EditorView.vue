<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import EditorCanvas from '../components/editor/EditorCanvas.vue'
import EditorRightPanel from '../components/editor/EditorRightPanel.vue'
import EditorToolPanel from '../components/editor/EditorToolPanel.vue'
import EditorToolbar from '../components/editor/EditorToolbar.vue'
import type { Operation } from '../stores/editor'
import { useEditorStore } from '../stores/editor'

const { t } = useI18n()
const router = useRouter()
const editor = useEditorStore()

// Pending op — araç panelinden geliyor, canvas'ta canlı önizleme için
const pendingOp = ref<Operation | null>(null)

function handleApply(op: Operation) {
  const labels: Record<string, string> = {
    brightness: 'brightness',
    contrast: 'contrast',
    saturation: 'saturation',
    sharpen: 'sharpen',
    rotate: 'rotate',
    flip_horizontal: 'flip_horizontal',
    flip_vertical: 'flip_vertical',
    grayscale: 'grayscale',
    resize: 'resize',
  }
  editor.addOperation(op, labels[op.op] ?? op.op)
  pendingOp.value = null
}

function handleBack() {
  if (editor.history.length > 1) {
    const confirmed = window.confirm(t('editor.unsavedWarning'))
    if (!confirmed) return
  }
  editor.reset()
  router.push('/')
}

async function handleSave() {
  // Görev #5'te Rust invoke bağlanacak
}

async function handleSaveAs() {
  // Görev #5'te Rust invoke bağlanacak
}
</script>

<template>
  <div class="flex flex-col h-screen overflow-hidden">
    <EditorToolbar
      @back="handleBack"
      @save="handleSave"
      @save-as="handleSaveAs"
    />

    <div class="flex flex-1 min-h-0">
      <EditorToolPanel
        v-model:pending-op="pendingOp"
        @apply="handleApply"
      />

      <EditorCanvas
        :file-path="editor.filePath"
        :operations="editor.operations"
        :pending-op="pendingOp"
      />

      <EditorRightPanel />
    </div>
  </div>
</template>
