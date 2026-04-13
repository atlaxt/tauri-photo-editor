<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useEditorStore } from '../../stores/editor'

type TabId = 'layers' | 'history' | 'info' | 'histogram'

const props = defineProps<{
  tabId: TabId
  imageWidth: number | null
  imageHeight: number | null
  imageUrl: string | null
}>()

const { t } = useI18n()
const editor = useEditorStore()

// ─── Layers (reversed — topmost layer shown first in panel) ─────────────────
const reversedLayers = computed(() => [...editor.layers].reverse())

async function handleAddLayer() {
  try {
    const { open } = await import('@tauri-apps/plugin-dialog')
    const selected = await open({
      multiple: false,
      filters: [{ name: t('home.imageFilterLabel'), extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp'] }],
    })
    if (!selected || typeof selected !== 'string')
      return
    const { convertFileSrc } = await import('@tauri-apps/api/core')
    const src = convertFileSrc(selected)
    const img = new Image()
    img.onload = () => {
      const name = selected.split(/[\\/]/).pop()?.replace(/\.[^.]+$/, '') ?? t('editor.layers.title')
      editor.addImageLayer(src, name, img.naturalWidth, img.naturalHeight)
    }
    img.src = src
  }
  catch (e) {
    console.error('[EditorPanelTabContent] Add layer failed', e)
  }
}

// ─── Info tab ──────────────────────────────────────────────────────────────

const fileFormat = computed(() =>
  editor.filePath?.split('.').pop()?.toUpperCase() ?? null,
)

const collapsed = ref(new Set<string>())
const pinned = ref(new Set<string>())

function isCollapsed(key: string) {
  return collapsed.value.has(key) && !pinned.value.has(key)
}
function toggleCollapse(key: string) {
  if (collapsed.value.has(key))
    collapsed.value.delete(key)
  else collapsed.value.add(key)
}
function togglePin(key: string) {
  if (pinned.value.has(key)) {
    pinned.value.delete(key)
  }
  else {
    pinned.value.add(key)
    collapsed.value.delete(key)
  }
}

// ─── Histogram tab ──────────────────────────────────────────────────────────

interface HistogramData { r: number[], g: number[], b: number[], lum: number[] }
const histogramData = ref<HistogramData | null>(null)
const histogramLoading = ref(false)

watch(() => props.imageUrl, async (url) => {
  if (!url) {
    histogramData.value = null
    return
  }
  if (props.tabId === 'histogram')
    computeHistogram(url)
})

watch(() => props.tabId, (tab) => {
  if (tab === 'histogram' && props.imageUrl && !histogramData.value)
    computeHistogram(props.imageUrl)
})

async function computeHistogram(url: string) {
  histogramLoading.value = true
  histogramData.value = null
  try {
    await new Promise<void>((resolve, reject) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const scale = Math.min(1, 200 / Math.max(img.naturalWidth, img.naturalHeight))
        canvas.width = Math.round(img.naturalWidth * scale)
        canvas.height = Math.round(img.naturalHeight * scale)
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data
        const bins = 64
        const r = new Array(bins).fill(0)
        const g = new Array(bins).fill(0)
        const b = new Array(bins).fill(0)
        const lum = new Array(bins).fill(0)
        for (let i = 0; i < data.length; i += 4) {
          const rv = data[i]
          const gv = data[i + 1]
          const bv = data[i + 2]
          r[Math.floor(rv / 256 * bins)]++
          g[Math.floor(gv / 256 * bins)]++
          b[Math.floor(bv / 256 * bins)]++
          const l = Math.round(0.2126 * rv + 0.7152 * gv + 0.0722 * bv)
          lum[Math.floor(l / 256 * bins)]++
        }
        const maxVal = Math.max(...r, ...g, ...b, ...lum)
        const norm = (arr: number[]) => arr.map(v => Math.round(v / maxVal * 100))
        histogramData.value = { r: norm(r), g: norm(g), b: norm(b), lum: norm(lum) }
        resolve()
      }
      img.onerror = reject
      img.src = url
    })
  }
  catch { histogramData.value = null }
  finally { histogramLoading.value = false }
}

// ─── History ────────────────────────────────────────────────────────────────

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
  <!-- ── KATMANLAR ── -->
  <template v-if="tabId === 'layers'">
    <!-- Add Layer button -->
    <div class="flex items-center justify-between px-3 py-1.5 border-b border-default">
      <span class="text-[10px] text-muted uppercase tracking-wide font-medium">
        {{ t('editor.layers.title') }}
      </span>
      <UTooltip :text="t('editor.layers.addLayer')">
        <button
          class="flex items-center justify-center w-5 h-5 rounded text-muted hover:text-default hover:bg-elevated transition-colors"
          :disabled="!editor.hasProject"
          @click="handleAddLayer"
        >
          <UIcon name="i-ph-plus" class="size-3.5" />
        </button>
      </UTooltip>
    </div>

    <div v-if="editor.layers.length === 0" class="flex items-center justify-center h-full">
      <p class="text-xs text-muted opacity-30">
        —
      </p>
    </div>

    <!-- Layers shown in reverse order (topmost first) -->
    <div
      v-for="layer in reversedLayers"
      :key="layer.id"
      class="group relative flex items-center gap-2 px-2 transition-colors cursor-pointer"
      :class="editor.selectedLayerId === layer.id ? 'bg-primary/10' : 'hover:bg-elevated'"
      style="height: 44px;"
      @click="editor.selectLayer(layer.id)"
    >
      <!-- Visibility toggle -->
      <button
        class="shrink-0 flex items-center justify-center w-5 h-5 rounded transition-colors"
        :class="layer.visible ? 'text-muted/40 hover:text-muted' : 'text-primary'"
        @click.stop="editor.updateLayer(layer.id, { visible: !layer.visible })"
      >
        <UIcon :name="layer.visible ? 'i-ph-eye' : 'i-ph-eye-slash'" class="size-3" />
      </button>

      <!-- Thumbnail -->
      <div
        class="size-8 rounded shrink-0 overflow-hidden ring-1 ring-inset ring-black/10 dark:ring-white/10 transition-opacity"
        :class="layer.visible ? '' : 'opacity-30'"
      >
        <img
          v-if="layer.imageSrc"
          :src="layer.imageSrc"
          class="w-full h-full object-cover select-none"
          draggable="false"
        >
        <div
          v-else
          class="w-full h-full flex items-center justify-center"
          :style="layer.backgroundColor ? { background: layer.backgroundColor } : {}"
        >
          <UIcon v-if="!layer.backgroundColor" name="i-ph-image" class="size-3 text-muted opacity-30" />
        </div>
      </div>

      <!-- Layer info -->
      <div class="flex-1 min-w-0 flex flex-col justify-center gap-px" :class="layer.visible ? '' : 'opacity-40'">
        <div class="flex items-center gap-1">
          <UIcon
            v-if="layer.type === 'base'"
            name="i-ph-lock"
            class="size-2.5 text-muted opacity-50 shrink-0"
          />
          <span class="text-xs font-medium truncate leading-none">{{ layer.name }}</span>
        </div>
        <span class="text-[10px] text-muted tabular-nums leading-none">{{ layer.opacity }}%</span>
      </div>

      <!-- Reorder buttons (only for non-base layers) -->
      <template v-if="layer.type !== 'base'">
        <div class="shrink-0 flex flex-col gap-px opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            class="flex items-center justify-center w-4 h-3 rounded text-muted hover:text-default transition-colors"
            @click.stop="editor.moveLayerUp(layer.id)"
          >
            <UIcon name="i-ph-caret-up" class="size-2.5" />
          </button>
          <button
            class="flex items-center justify-center w-4 h-3 rounded text-muted hover:text-default transition-colors"
            @click.stop="editor.moveLayerDown(layer.id)"
          >
            <UIcon name="i-ph-caret-down" class="size-2.5" />
          </button>
        </div>
      </template>

      <!-- Settings popover -->
      <UPopover :ui="{ content: 'w-52' }">
        <button
          class="shrink-0 flex items-center justify-center w-5 h-5 rounded text-muted opacity-0 group-hover:opacity-100 hover:text-default transition-all"
          @click.stop
        >
          <UIcon name="i-ph-dots-three" class="size-3.5" />
        </button>
        <template #content>
          <div class="p-3 space-y-3">
            <p class="text-xs font-semibold">
              {{ t('editor.layers.settings') }}
            </p>

            <!-- Name -->
            <div class="space-y-1.5">
              <p class="text-xs text-muted">
                {{ t('editor.layers.name') }}
              </p>
              <UInput
                :model-value="layer.name"
                size="xs"
                @click.stop
                @change="editor.updateLayer(layer.id, { name: ($event.target as HTMLInputElement).value })"
              />
            </div>

            <!-- Opacity -->
            <div class="space-y-1.5">
              <div class="flex justify-between">
                <span class="text-xs text-muted">{{ t('editor.layers.opacity') }}</span>
                <span class="text-xs tabular-nums text-muted">{{ layer.opacity }}%</span>
              </div>
              <input
                :value="layer.opacity"
                type="range"
                min="0"
                max="100"
                class="w-full h-1 accent-primary cursor-pointer"
                @click.stop
                @input="editor.updateLayer(layer.id, { opacity: Number(($event.target as HTMLInputElement).value) })"
              >
            </div>

            <!-- Rotation (image layers only) -->
            <div v-if="layer.type !== 'base'" class="space-y-1.5">
              <div class="flex justify-between">
                <span class="text-xs text-muted">{{ t('editor.layers.rotation') }}</span>
                <span class="text-xs tabular-nums text-muted">{{ layer.rotation }}°</span>
              </div>
              <input
                :value="layer.rotation"
                type="range"
                min="-180"
                max="180"
                class="w-full h-1 accent-primary cursor-pointer"
                @click.stop
                @input="editor.updateLayer(layer.id, { rotation: Number(($event.target as HTMLInputElement).value) })"
              >
            </div>

            <!-- Blend mode -->
            <div class="space-y-1.5">
              <span class="text-xs text-muted">{{ t('editor.layers.blendMode') }}</span>
              <USelect
                :model-value="layer.blendMode"
                size="xs"
                :items="[{ label: t('editor.layers.blendNormal'), value: 'normal' }]"
                @click.stop
                @update:model-value="(v: string) => editor.updateLayer(layer.id, { blendMode: v as 'normal' })"
              />
            </div>

            <!-- Delete (non-base only) -->
            <template v-if="layer.type !== 'base'">
              <UDivider />
              <button
                class="w-full flex items-center gap-2 text-xs text-red-500 hover:text-red-400 transition-colors py-0.5"
                @click.stop="editor.removeLayer(layer.id)"
              >
                <UIcon name="i-ph-trash" class="size-3" />
                {{ t('editor.layers.deleteLayer') }}
              </button>
            </template>

            <!-- Base layer locked hint -->
            <template v-else>
              <UDivider />
              <p class="text-[10px] text-muted opacity-50 flex items-center gap-1">
                <UIcon name="i-ph-lock" class="size-3" />
                {{ t('editor.layers.baseLocked') }}
              </p>
            </template>
          </div>
        </template>
      </UPopover>
    </div>
  </template>

  <!-- ── GEÇMİŞ ── -->
  <template v-else-if="tabId === 'history'">
    <div v-if="editor.history.length === 0" class="flex items-center justify-center h-full">
      <p class="text-xs text-muted opacity-30">
        —
      </p>
    </div>
    <button
      v-for="(entry, i) in editor.history"
      :key="i"
      class="w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors text-xs"
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
        {{ i === 0 ? t('editor.history.opened') : t(opLabels[entry.label] ?? 'editor.tools.adjust') }}
      </span>
    </button>
  </template>

  <!-- ── BİLGİ ── -->
  <template v-else-if="tabId === 'info'">
    <div v-if="editor.layers.length === 0" class="flex items-center justify-center h-full">
      <p class="text-xs text-muted opacity-30">
        {{ t('editor.panel.noFile') }}
      </p>
    </div>
    <div v-for="(layer, idx) in editor.layers" :key="layer.id" class="border-b border-default last:border-b-0">
      <div
        class="w-full flex items-center gap-2 px-3 hover:bg-elevated transition-colors cursor-pointer"
        style="height: 36px;"
        @click="toggleCollapse(`info-${layer.id}`)"
      >
        <UIcon
          :name="isCollapsed(`info-${layer.id}`) ? 'i-ph-caret-right' : 'i-ph-caret-down'"
          class="size-3 text-muted shrink-0"
        />
        <span class="flex-1 text-xs font-medium truncate text-left">{{ layer.name }}</span>
        <button
          class="shrink-0 transition-colors"
          :class="pinned.has(`info-${layer.id}`) ? 'text-primary' : 'text-muted/30 hover:text-muted'"
          @click.stop="togglePin(`info-${layer.id}`)"
        >
          <UIcon name="i-ph-push-pin" class="size-3" />
        </button>
      </div>
      <div v-if="!isCollapsed(`info-${layer.id}`)" class="px-3 pb-3">
        <div class="grid grid-cols-2 gap-x-2 gap-y-1.5">
          <span class="text-[11px] text-muted">{{ t('editor.panel.infoDimensions') }}</span>
          <span class="text-[11px] tabular-nums text-right">
            {{ `${layer.width} × ${layer.height}` }}
          </span>
          <span class="text-[11px] text-muted">{{ t('editor.panel.infoFormat') }}</span>
          <span class="text-[11px] text-right">{{ (idx === 0 && fileFormat) ? fileFormat : t('editor.panel.infoUnknown') }}</span>
          <span class="text-[11px] text-muted">{{ t('editor.panel.infoOpacity') }}</span>
          <span class="text-[11px] tabular-nums text-right">{{ layer.opacity }}%</span>
          <span class="text-[11px] text-muted">{{ t('editor.panel.infoRotation') }}</span>
          <span class="text-[11px] tabular-nums text-right">{{ layer.rotation }}°</span>
        </div>
      </div>
    </div>
  </template>

  <!-- ── HİSTOGRAM ── -->
  <template v-else-if="tabId === 'histogram'">
    <div v-if="!editor.filePath" class="flex items-center justify-center h-full">
      <p class="text-xs text-muted opacity-30">
        {{ t('editor.panel.noFile') }}
      </p>
    </div>
    <div v-else-if="histogramLoading" class="flex items-center justify-center h-full">
      <UIcon name="i-ph-spinner" class="size-5 text-muted animate-spin opacity-40" />
    </div>
    <div v-else-if="histogramData" class="p-3 space-y-3">
      <div
        v-for="{ key, color, labelKey } in [
          { key: 'lum', color: 'bg-muted/50', labelKey: 'editor.panel.histogramLum' },
          { key: 'r', color: 'bg-red-500/70', labelKey: 'editor.panel.histogramR' },
          { key: 'g', color: 'bg-green-500/70', labelKey: 'editor.panel.histogramG' },
          { key: 'b', color: 'bg-blue-500/70', labelKey: 'editor.panel.histogramB' },
        ]"
        :key="key"
      >
        <p class="text-[10px] text-muted mb-1">
          {{ t(labelKey) }}
        </p>
        <div class="flex items-end gap-px h-8">
          <div
            v-for="(val, i) in (histogramData as any)[key]"
            :key="i"
            :class="color"
            class="flex-1 rounded-sm min-h-px"
            :style="{ height: `${Math.max(1, val)}%` }"
          />
        </div>
      </div>
    </div>
  </template>
</template>
