<script setup lang="ts">
import { useI18n } from 'vue-i18n'

export type ToolId = 'adjust' | 'sharpen' | 'rotate' | 'flip' | 'grayscale' | 'resize'

const { t } = useI18n()

const activeTool = defineModel<ToolId | null>('activeTool', { default: null })

const tools: { id: ToolId, icon: string, labelKey: string }[] = [
  { id: 'adjust', icon: 'i-ph-sliders-horizontal', labelKey: 'editor.tools.adjust' },
  { id: 'sharpen', icon: 'i-ph-aperture', labelKey: 'editor.tools.sharpen' },
  { id: 'rotate', icon: 'i-ph-arrow-clockwise', labelKey: 'editor.tools.rotate' },
  { id: 'flip', icon: 'i-ph-arrows-horizontal', labelKey: 'editor.tools.flip' },
  { id: 'grayscale', icon: 'i-ph-circle-half', labelKey: 'editor.tools.grayscale' },
  { id: 'resize', icon: 'i-ph-frame-corners', labelKey: 'editor.tools.resize' },
]

function toggle(id: ToolId) {
  activeTool.value = activeTool.value === id ? null : id
}
</script>

<template>
  <div class="flex flex-col items-center gap-0.5 py-2 px-1.5 border-r border-default w-12 shrink-0">
    <UTooltip
      v-for="tool in tools"
      :key="tool.id"
      :text="t(tool.labelKey)"
      :delay-duration="0"
      :content="{ side: 'right', position: 'center' }"
    >
      <button
        class="flex items-center justify-center size-8 rounded-lg transition-colors"
        :class="activeTool === tool.id
          ? 'bg-primary/15 text-primary'
          : 'text-muted hover:bg-elevated hover:text-default'"
        @click="toggle(tool.id)"
      >
        <UIcon :name="tool.icon" class="size-4" />
      </button>
    </UTooltip>
  </div>
</template>
