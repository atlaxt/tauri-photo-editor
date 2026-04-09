<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useEditorStore } from '../../stores/editor'

const { t } = useI18n()
const editor = useEditorStore()

const opLabels: Record<string, string> = {
  brightness: 'Parlaklık',
  contrast: 'Kontrast',
  saturation: 'Doygunluk',
  sharpen: 'Keskinlik',
  rotate: 'Döndür',
  flip_horizontal: 'Yatay çevir',
  flip_vertical: 'Dikey çevir',
  grayscale: 'Siyah-Beyaz',
  resize: 'Boyutlandır',
  output: 'Çıktı',
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
      <div class="flex-1 overflow-y-auto p-2">
        <!-- Faz 1: tek katman -->
        <div
          v-if="editor.filePath"
          class="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-elevated"
        >
          <UIcon name="i-ph-image" class="size-3.5 text-muted shrink-0" />
          <span class="text-xs truncate">{{ t('editor.layers.base') }}</span>
        </div>
        <div v-else class="flex items-center justify-center h-full">
          <p class="text-xs text-muted opacity-50">—</p>
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
            :name="i === 0 ? 'i-ph-folder-open' : 'i-ph-circle'"
            class="size-3 shrink-0"
            :class="i === editor.historyIndex ? 'text-primary' : 'text-muted opacity-50'"
          />
          <span class="truncate">
            {{ i === 0 ? t('editor.history.opened') : (opLabels[entry.label] ?? entry.label) }}
          </span>
        </button>

        <div v-if="editor.history.length === 0" class="flex items-center justify-center py-4">
          <p class="text-xs text-muted opacity-50">—</p>
        </div>
      </div>
    </div>

  </aside>
</template>
