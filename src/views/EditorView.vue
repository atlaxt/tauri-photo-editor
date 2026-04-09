<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import EditorCanvas from '../components/editor/EditorCanvas.vue'
import EditorRightPanel from '../components/editor/EditorRightPanel.vue'
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
      />

      <EditorRightPanel />
    </div>
  </div>
</template>
