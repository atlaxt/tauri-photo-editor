<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useEditorStore } from '../../stores/editor'

const { t } = useI18n()
const editor = useEditorStore()

// Thumbnail URL — filePath'ten convertFileSrc ile
const thumbUrl = ref<string | null>(null)

watch(() => editor.filePath, async (path) => {
  if (!path) {
    thumbUrl.value = null
    return
  }
  try {
    const { convertFileSrc } = await import('@tauri-apps/api/core')
    thumbUrl.value = convertFileSrc(path)
  }
  catch {
    thumbUrl.value = path
  }
}, { immediate: true })

const opLabels: Record<string, string> = {
  brightness: 'editor.tools.adjust',
  contrast: 'editor.tools.adjust',
  saturation: 'editor.tools.adjust',
  sharpen: 'editor.tools.sharpen',
  rotate: 'editor.tools.rotate',
  flip_horizontal: 'editor.params.flipH',
  flip_vertical: 'editor.params.flipV',
  grayscale: 'editor.tools.grayscale',
  resize: 'editor.tools.resize',
}
</script>

<template>
  <aside class="w-52 flex flex-col border-l border-default shrink-0">
    <!-- Katmanlar (üst) -->
    <div class="flex flex-col border-b border-default" style="flex: 1 1 0; min-height: 0;">
      <div class="px-3 py-2 shrink-0">
        <p class="text-xs font-medium text-muted uppercase tracking-wider">
          {{ t('editor.layers.title') }}
        </p>
      </div>

      <div class="flex-1 overflow-y-auto">
        <div v-if="editor.layers.length === 0" class="flex items-center justify-center h-full">
          <p class="text-xs text-muted opacity-30">
            —
          </p>
        </div>

        <!-- Katman satırı -->
        <div
          v-for="layer in editor.layers"
          :key="layer.id"
          class="group relative flex items-center gap-2 px-2 hover:bg-elevated transition-colors"
          style="height: 44px;"
        >
          <!-- Görünürlük toggle -->
          <button
            class="shrink-0 flex items-center justify-center w-5 h-5 rounded transition-colors"
            :class="layer.visible
              ? 'text-muted/40 hover:text-muted'
              : 'text-primary'"
            @click="editor.updateLayer(layer.id, { visible: !layer.visible })"
          >
            <UIcon
              :name="layer.visible ? 'i-ph-eye' : 'i-ph-eye-slash'"
              class="size-3"
            />
          </button>

          <!-- Thumbnail -->
          <div
            class="size-8 rounded shrink-0 overflow-hidden ring-1 ring-inset ring-black/10 dark:ring-white/10 transition-opacity"
            :class="layer.visible ? '' : 'opacity-30'"
          >
            <img
              v-if="thumbUrl"
              :src="thumbUrl"
              class="w-full h-full object-cover select-none"
              draggable="false"
            >
            <div v-else class="w-full h-full bg-elevated flex items-center justify-center">
              <UIcon name="i-ph-image" class="size-3 text-muted opacity-30" />
            </div>
          </div>

          <!-- İsim + opaklık -->
          <div class="flex-1 min-w-0 flex flex-col justify-center gap-px" :class="layer.visible ? '' : 'opacity-40'">
            <span class="text-xs font-medium truncate leading-none">{{ layer.name }}</span>
            <span class="text-[10px] text-muted tabular-nums leading-none">{{ layer.opacity }}%</span>
          </div>

          <!-- Ayar popover (hover'da görünür) -->
          <UPopover :ui="{ content: 'w-52' }">
            <button
              class="shrink-0 flex items-center justify-center w-5 h-5 rounded text-muted opacity-0 group-hover:opacity-100 hover:text-default hover:bg-elevated transition-all"
            >
              <UIcon name="i-ph-dots-three" class="size-3.5" />
            </button>

            <template #content>
              <div class="p-3 space-y-4">
                <p class="text-xs font-semibold">
                  {{ t('editor.layers.settings') }}
                </p>

                <!-- İsim -->
                <div class="space-y-1.5">
                  <p class="text-xs text-muted">
                    {{ t('editor.layers.name') }}
                  </p>
                  <UInput
                    :model-value="layer.name"
                    size="xs"
                    @change="editor.updateLayer(layer.id, { name: ($event.target as HTMLInputElement).value })"
                  />
                </div>

                <!-- Opaklık -->
                <div class="space-y-1.5">
                  <div class="flex justify-between">
                    <span class="text-xs text-muted">{{ t('editor.layers.opacity') }}</span>
                    <span class="text-xs tabular-nums text-muted">{{ layer.opacity }}%</span>
                  </div>
                  <input
                    :value="layer.opacity"
                    type="range" min="0" max="100"
                    class="w-full h-1 accent-primary cursor-pointer"
                    @input="editor.updateLayer(layer.id, { opacity: Number(($event.target as HTMLInputElement).value) })"
                  >
                </div>

                <!-- Döndürme -->
                <div class="space-y-1.5">
                  <div class="flex justify-between">
                    <span class="text-xs text-muted">{{ t('editor.layers.rotation') }}</span>
                    <span class="text-xs tabular-nums text-muted">{{ layer.rotation }}°</span>
                  </div>
                  <input
                    :value="layer.rotation"
                    type="range" min="-180" max="180"
                    class="w-full h-1 accent-primary cursor-pointer"
                    @input="editor.updateLayer(layer.id, { rotation: Number(($event.target as HTMLInputElement).value) })"
                  >
                </div>
              </div>
            </template>
          </UPopover>
        </div>
      </div>
    </div>

    <!-- Geçmiş (alt) -->
    <div class="flex flex-col" style="flex: 1 1 0; min-height: 0;">
      <div class="px-3 py-2 shrink-0">
        <p class="text-xs font-medium text-muted uppercase tracking-wider">
          {{ t('editor.history.title') }}
        </p>
      </div>

      <div class="flex-1 overflow-y-auto p-2 space-y-0.5">
        <button
          v-for="(entry, i) in editor.history"
          :key="i"
          class="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-colors text-xs"
          :class="i === editor.historyIndex
            ? 'bg-primary/10 text-primary font-medium'
            : 'hover:bg-elevated text-muted'"
          @click="editor.jumpTo(i)"
        >
          <UIcon
            :name="i === 0 ? 'i-ph-folder-open' : 'i-ph-dot-outline'"
            class="size-3 shrink-0"
            :class="i === editor.historyIndex ? 'text-primary' : 'opacity-40'"
          />
          <span class="truncate">
            {{ i === 0
              ? t('editor.history.opened')
              : t(opLabels[entry.label] ?? 'editor.tools.adjust') }}
          </span>
        </button>

        <div v-if="editor.history.length === 0" class="flex items-center justify-center py-6">
          <p class="text-xs text-muted opacity-40">
            —
          </p>
        </div>
      </div>
    </div>
  </aside>
</template>
