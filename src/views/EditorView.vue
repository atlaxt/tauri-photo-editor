<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { invoke } from '@tauri-apps/api/core'
import EditorCanvas from '../components/editor/EditorCanvas.vue'
import EditorRightPanel from '../components/editor/EditorRightPanel.vue'
import EditorStatusBar from '../components/editor/EditorStatusBar.vue'
import EditorToolIconBar from '../components/editor/EditorToolIconBar.vue'
import EditorToolParams from '../components/editor/EditorToolParams.vue'
import EditorToolbar from '../components/editor/EditorToolbar.vue'
import type { Operation } from '../stores/editor'
import { useEditorStore } from '../stores/editor'
import type { ToolId } from '../components/editor/EditorToolIconBar.vue'

const { t } = useI18n()
const router = useRouter()
const editor = useEditorStore()

const activeTool = ref<ToolId | null>(null)
const pendingOp = ref<Operation | null>(null)
const saving = ref(false)
const imageWidth = ref<number | null>(null)
const imageHeight = ref<number | null>(null)
const zoomLevel = ref<number | null>(null)
const canvasImageUrl = ref<string | null>(null)

watch(() => editor.filePath, async (path) => {
  if (!path) { canvasImageUrl.value = null; return }
  try {
    const { convertFileSrc } = await import('@tauri-apps/api/core')
    canvasImageUrl.value = convertFileSrc(path)
  }
  catch {
    canvasImageUrl.value = path
  }
}, { immediate: true })

function handleApply(op: Operation) {
  editor.addOperation(op, op.op)
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
  if (!editor.filePath || saving.value) return
  saving.value = true
  try {
    await invoke('save_image', {
      sourcePath: editor.filePath,
      destPath: editor.filePath,
      ops: editor.operations,
    })
  }
  finally {
    saving.value = false
  }
}

async function handleSaveAs() {
  if (!editor.filePath || saving.value) return
  const { save } = await import('@tauri-apps/plugin-dialog')
  const dest = await save({
    defaultPath: editor.fileName ?? undefined,
    filters: [
      { name: 'JPEG', extensions: ['jpg', 'jpeg'] },
      { name: 'PNG', extensions: ['png'] },
      { name: 'WebP', extensions: ['webp'] },
    ],
  })
  if (!dest) return
  saving.value = true
  try {
    await invoke('save_image', {
      sourcePath: editor.filePath,
      destPath: dest,
      ops: editor.operations,
    })
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="flex flex-col h-screen overflow-hidden">
    <EditorToolbar
      :saving="saving"
      @back="handleBack"
      @save="handleSave"
      @save-as="handleSaveAs"
    />

    <div class="flex flex-1 min-h-0">
      <!-- Dar ikon çubuğu -->
      <EditorToolIconBar v-model:active-tool="activeTool" />

      <!-- Params paneli: araç seçilince ikon çubuğunun yanında açılır -->
      <Transition
        enter-active-class="transition-all duration-150 ease-out"
        leave-active-class="transition-all duration-100 ease-in"
        enter-from-class="opacity-0 -translate-x-2"
        leave-to-class="opacity-0 -translate-x-2"
      >
        <EditorToolParams
          v-if="activeTool"
          :tool="activeTool"
          v-model:pending-op="pendingOp"
          @apply="handleApply"
        />
      </Transition>

      <EditorCanvas
        :file-path="editor.filePath"
        :operations="editor.operations"
        :pending-op="pendingOp"
        @image-size-change="(w, h) => { imageWidth = w; imageHeight = h }"
        @zoom-change="(z) => { zoomLevel = z }"
      />

      <EditorRightPanel
        :image-width="imageWidth"
        :image-height="imageHeight"
        :image-url="canvasImageUrl"
      />
    </div>

    <EditorStatusBar :image-width="imageWidth" :image-height="imageHeight" :zoom="zoomLevel" />
  </div>
</template>
