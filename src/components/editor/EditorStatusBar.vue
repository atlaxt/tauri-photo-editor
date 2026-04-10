<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useEditorStore } from '../../stores/editor'

const props = defineProps<{
  imageWidth: number | null
  imageHeight: number | null
  zoom: number | null
}>()

const zoomLabel = computed(() => {
  if (props.zoom === null)
    return null
  return `${Math.round(props.zoom * 100)}%`
})

const { t } = useI18n()
const editor = useEditorStore()
</script>

<template>
  <footer class="flex items-center gap-4 px-4 border-t border-default shrink-0" style="height: 28px;">
    <!-- Boyut -->
    <span class="text-[11px] text-muted tabular-nums">
      <template v-if="imageWidth && imageHeight">
        {{ t('editor.statusBar.dimensions', { w: imageWidth, h: imageHeight }) }}
      </template>
      <template v-else>
        {{ t('editor.statusBar.noFile') }}
      </template>
    </span>

    <!-- Separator -->
    <template v-if="zoomLabel">
      <span class="text-[11px] text-muted/30">·</span>
      <span class="text-[11px] text-muted tabular-nums">{{ zoomLabel }}</span>
    </template>

    <!-- Spacer -->
    <div class="flex-1" />

    <!-- Dosya adı -->
    <span v-if="editor.fileName" class="text-[11px] text-muted/60 truncate max-w-48">
      {{ editor.fileName }}
    </span>
  </footer>
</template>
