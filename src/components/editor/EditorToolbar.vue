<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useEditorStore } from '../../stores/editor'

defineProps<{ saving?: boolean }>()

const emit = defineEmits<{
  back: []
  save: []
  saveAs: []
}>()
const { t } = useI18n()
const editor = useEditorStore()
</script>

<template>
  <header class="flex items-center gap-2 px-3 py-2 border-b border-default shrink-0">
    <!-- Sol: geri + dosya adı -->
    <div class="flex items-center gap-1 min-w-0">
      <UButton
        :label="t('editor.actions.back')"
        icon="i-ph-house"
        variant="ghost"
        color="neutral"
        size="sm"
        @click="emit('back')"
      />
      <USeparator orientation="vertical" class="h-4 mx-1" />
      <span class="text-sm text-muted truncate max-w-48">
        {{ editor.fileName ?? '—' }}
      </span>
    </div>

    <div class="flex-1" />

    <!-- Sağ: geri al / ileri al + kaydet -->
    <div class="flex items-center gap-1">
      <UButton
        icon="i-ph-arrow-counter-clockwise"
        variant="ghost"
        color="neutral"
        size="sm"
        :disabled="!editor.canUndo"
        :aria-label="t('editor.actions.undo')"
        @click="editor.undo()"
      />
      <UButton
        icon="i-ph-arrow-clockwise"
        variant="ghost"
        color="neutral"
        size="sm"
        :disabled="!editor.canRedo"
        :aria-label="t('editor.actions.redo')"
        @click="editor.redo()"
      />
      <USeparator orientation="vertical" class="h-4 mx-1" />
      <UButton
        :label="t('editor.actions.saveAs')"
        variant="ghost"
        color="neutral"
        size="sm"
        :disabled="saving"
        @click="emit('saveAs')"
      />
      <UButton
        :label="t('editor.actions.save')"
        variant="solid"
        color="primary"
        size="sm"
        :loading="saving"
        @click="emit('save')"
      />
    </div>
  </header>
</template>
