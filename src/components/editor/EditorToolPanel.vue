<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Operation, OperationType } from '../../stores/editor'

const { t } = useI18n()

const emit = defineEmits<{
  apply: [op: Operation]
}>()

type ToolId = 'adjust' | 'sharpen' | 'rotate' | 'flip' | 'grayscale' | 'resize'

interface Tool {
  id: ToolId
  icon: string
  labelKey: string
}

const tools: Tool[] = [
  { id: 'adjust', icon: 'i-ph-sliders-horizontal', labelKey: 'editor.tools.adjust' },
  { id: 'sharpen', icon: 'i-ph-aperture', labelKey: 'editor.tools.sharpen' },
  { id: 'rotate', icon: 'i-ph-arrow-clockwise', labelKey: 'editor.tools.rotate' },
  { id: 'flip', icon: 'i-ph-arrows-horizontal', labelKey: 'editor.tools.flip' },
  { id: 'grayscale', icon: 'i-ph-circle-half', labelKey: 'editor.tools.grayscale' },
  { id: 'resize', icon: 'i-ph-frame-corners', labelKey: 'editor.tools.resize' },
]

const activeTool = ref<ToolId | null>(null)

// Araç parametreleri
const adjust = ref({ brightness: 0, contrast: 0, saturation: 0 })
const sharpen = ref({ amount: 0 })
const rotate = ref({ angle: 0 })
const resize = ref({ width: 0, height: 0, keepAspect: true })

// Pending op hesapla (canvas preview için)
const pendingOp = defineModel<Operation | null>('pendingOp', { default: null })

watch([activeTool, adjust, sharpen, rotate], () => {
  if (!activeTool.value) { pendingOp.value = null; return }

  if (activeTool.value === 'adjust') {
    // Birden fazla op; preview için son değerleri yansıt
    pendingOp.value = { op: 'brightness', params: { value: adjust.value.brightness } }
  }
  else if (activeTool.value === 'sharpen') {
    pendingOp.value = { op: 'sharpen', params: { value: sharpen.value.amount } }
  }
  else if (activeTool.value === 'rotate') {
    pendingOp.value = { op: 'rotate', params: { value: rotate.value.angle } }
  }
  else {
    pendingOp.value = null
  }
}, { deep: true })

function selectTool(id: ToolId) {
  activeTool.value = activeTool.value === id ? null : id
  pendingOp.value = null
}

function applyAdjust() {
  if (adjust.value.brightness !== 0)
    emit('apply', { op: 'brightness', params: { value: adjust.value.brightness } })
  if (adjust.value.contrast !== 0)
    emit('apply', { op: 'contrast', params: { value: adjust.value.contrast } })
  if (adjust.value.saturation !== 0)
    emit('apply', { op: 'saturation', params: { value: adjust.value.saturation } })
  adjust.value = { brightness: 0, contrast: 0, saturation: 0 }
  activeTool.value = null
}

function applySharpen() {
  if (sharpen.value.amount !== 0)
    emit('apply', { op: 'sharpen', params: { value: sharpen.value.amount } })
  sharpen.value = { amount: 0 }
  activeTool.value = null
}

function applyRotate() {
  if (rotate.value.angle !== 0)
    emit('apply', { op: 'rotate', params: { value: rotate.value.angle } })
  rotate.value = { angle: 0 }
  activeTool.value = null
}

function applyFlip(direction: 'flip_horizontal' | 'flip_vertical') {
  emit('apply', { op: direction as OperationType, params: {} })
}

function applyGrayscale() {
  emit('apply', { op: 'grayscale', params: {} })
  activeTool.value = null
}

function applyResize() {
  if (resize.value.width > 0 || resize.value.height > 0) {
    emit('apply', { op: 'resize', params: { ...resize.value } })
  }
  resize.value = { width: 0, height: 0, keepAspect: true }
  activeTool.value = null
}
</script>

<template>
  <aside class="w-52 flex flex-col border-r border-default shrink-0 overflow-y-auto">
    <!-- Araç listesi -->
    <nav class="p-2 space-y-0.5">
      <button
        v-for="tool in tools"
        :key="tool.id"
        class="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-colors"
        :class="activeTool === tool.id
          ? 'bg-primary/10 text-primary font-medium'
          : 'text-default hover:bg-elevated'"
        @click="selectTool(tool.id)"
      >
        <UIcon :name="tool.icon" class="size-4 shrink-0" />
        {{ t(tool.labelKey) }}
      </button>
    </nav>

    <UDivider v-if="activeTool" class="mx-3" />

    <!-- Parametre alanı -->
    <div v-if="activeTool" class="p-3 space-y-4 flex-1">

      <!-- Ayarlar -->
      <template v-if="activeTool === 'adjust'">
        <div class="space-y-3">
          <div v-for="key in (['brightness', 'contrast', 'saturation'] as const)" :key="key">
            <div class="flex justify-between mb-1">
              <span class="text-xs text-muted">{{ t(`editor.params.${key}`) }}</span>
              <span class="text-xs tabular-nums">{{ adjust[key] }}</span>
            </div>
            <input
              v-model.number="adjust[key]"
              type="range" min="-100" max="100"
              class="w-full accent-primary h-1 cursor-pointer"
            >
          </div>
        </div>
        <UButton :label="t('editor.actions.apply')" size="xs" block @click="applyAdjust" />
      </template>

      <!-- Keskinlik -->
      <template v-else-if="activeTool === 'sharpen'">
        <div>
          <div class="flex justify-between mb-1">
            <span class="text-xs text-muted">{{ t('editor.params.amount') }}</span>
            <span class="text-xs tabular-nums">{{ sharpen.amount }}</span>
          </div>
          <input
            v-model.number="sharpen.amount"
            type="range" min="0" max="10"
            class="w-full accent-primary h-1 cursor-pointer"
          >
        </div>
        <UButton :label="t('editor.actions.apply')" size="xs" block @click="applySharpen" />
      </template>

      <!-- Döndür -->
      <template v-else-if="activeTool === 'rotate'">
        <div>
          <div class="flex justify-between mb-1">
            <span class="text-xs text-muted">{{ t('editor.params.angle') }}</span>
            <span class="text-xs tabular-nums">{{ rotate.angle }}°</span>
          </div>
          <input
            v-model.number="rotate.angle"
            type="range" min="-180" max="180"
            class="w-full accent-primary h-1 cursor-pointer"
          >
        </div>
        <UButton :label="t('editor.actions.apply')" size="xs" block @click="applyRotate" />
      </template>

      <!-- Çevir -->
      <template v-else-if="activeTool === 'flip'">
        <div class="space-y-2">
          <UButton
            :label="t('editor.params.flipH')"
            icon="i-ph-arrows-horizontal"
            variant="soft" color="neutral" size="xs" block
            @click="applyFlip('flip_horizontal')"
          />
          <UButton
            :label="t('editor.params.flipV')"
            icon="i-ph-arrows-vertical"
            variant="soft" color="neutral" size="xs" block
            @click="applyFlip('flip_vertical')"
          />
        </div>
      </template>

      <!-- Siyah-Beyaz -->
      <template v-else-if="activeTool === 'grayscale'">
        <p class="text-xs text-muted">{{ t('editor.tools.grayscale') }}</p>
        <UButton :label="t('editor.actions.apply')" size="xs" block @click="applyGrayscale" />
      </template>

      <!-- Boyutlandır -->
      <template v-else-if="activeTool === 'resize'">
        <div class="space-y-2">
          <div>
            <p class="text-xs text-muted mb-1">{{ t('editor.params.width') }}</p>
            <UInput v-model.number="resize.width" type="number" size="xs" />
          </div>
          <div>
            <p class="text-xs text-muted mb-1">{{ t('editor.params.height') }}</p>
            <UInput v-model.number="resize.height" type="number" size="xs" />
          </div>
          <label class="flex items-center gap-2 cursor-pointer">
            <UCheckbox v-model="resize.keepAspect" />
            <span class="text-xs text-muted">{{ t('editor.params.keepAspect') }}</span>
          </label>
        </div>
        <UButton :label="t('editor.actions.apply')" size="xs" block @click="applyResize" />
      </template>
    </div>
  </aside>
</template>
