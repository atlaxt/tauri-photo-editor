<script setup lang="ts">
import type { Operation, OperationType } from '../../stores/editor'
import type { ToolId } from './EditorToolIconBar.vue'
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useEditorStore } from '../../stores/editor'

const props = defineProps<{ tool: ToolId }>()

const emit = defineEmits<{
  apply: [op: Operation]
  canvasResize: [width: number, height: number]
}>()

const { t } = useI18n()
const editor = useEditorStore()

const pendingOp = defineModel<Operation | null>('pendingOp', { default: null })

const adjust = ref({ brightness: 0, contrast: 0, saturation: 0 })
const sharpen = ref({ amount: 0 })
const rotate = ref({ angle: 0 })
const resize = ref({ width: 0, height: 0, keepAspect: true })

// Reset params when tool changes
watch(() => props.tool, () => {
  adjust.value = { brightness: 0, contrast: 0, saturation: 0 }
  sharpen.value = { amount: 0 }
  rotate.value = { angle: 0 }
  resize.value = {
    width: editor.canvasWidth ?? 0,
    height: editor.canvasHeight ?? 0,
    keepAspect: true,
  }
  pendingOp.value = null
})

watch(() => [editor.canvasWidth, editor.canvasHeight], ([w, h]) => {
  if (w && h && props.tool === 'resize') {
    resize.value.width = w
    resize.value.height = h
  }
}, { immediate: true })

// Canlı önizleme için pendingOp hesapla
watch([adjust, sharpen, rotate], () => {
  if (props.tool === 'adjust')
    pendingOp.value = { op: 'brightness', params: { value: adjust.value.brightness } }
  else if (props.tool === 'sharpen')
    pendingOp.value = { op: 'sharpen', params: { value: sharpen.value.amount } }
  else if (props.tool === 'rotate')
    pendingOp.value = { op: 'rotate', params: { value: rotate.value.angle } }
  else
    pendingOp.value = null
}, { deep: true })

function applyAdjust() {
  if (adjust.value.brightness !== 0)
    emit('apply', { op: 'brightness', params: { value: adjust.value.brightness } })
  if (adjust.value.contrast !== 0)
    emit('apply', { op: 'contrast', params: { value: adjust.value.contrast } })
  if (adjust.value.saturation !== 0)
    emit('apply', { op: 'saturation', params: { value: adjust.value.saturation } })
  adjust.value = { brightness: 0, contrast: 0, saturation: 0 }
}

function applySharpen() {
  if (sharpen.value.amount !== 0)
    emit('apply', { op: 'sharpen', params: { value: sharpen.value.amount } })
  sharpen.value = { amount: 0 }
}

function applyRotate() {
  if (rotate.value.angle !== 0)
    emit('apply', { op: 'rotate', params: { value: rotate.value.angle } })
  rotate.value = { angle: 0 }
}

function applyFlip(dir: 'flip_horizontal' | 'flip_vertical') {
  emit('apply', { op: dir as OperationType, params: {} })
}

function applyGrayscale() {
  emit('apply', { op: 'grayscale', params: {} })
}

function applyResize() {
  if (resize.value.width > 0 && resize.value.height > 0)
    emit('canvasResize', resize.value.width, resize.value.height)
}
</script>

<template>
  <div class="w-52 flex flex-col border-r border-default shrink-0 overflow-y-auto">
    <!-- Başlık -->
    <div class="px-4 py-3 border-b border-default shrink-0">
      <p class="text-xs font-medium">
        {{ t(`editor.tools.${tool}`) }}
      </p>
    </div>

    <div class="p-4 space-y-5 flex-1">
      <!-- Ayarlar -->
      <template v-if="tool === 'adjust'">
        <div
          v-for="key in (['brightness', 'contrast', 'saturation'] as const)"
          :key="key"
          class="space-y-1.5"
        >
          <div class="flex justify-between">
            <span class="text-xs text-muted">{{ t(`editor.params.${key}`) }}</span>
            <span class="text-xs tabular-nums text-muted">{{ adjust[key] > 0 ? `+${adjust[key]}` : adjust[key] }}</span>
          </div>
          <USlider v-model="adjust[key]" :min="-100" :max="100" size="xs" />
        </div>
        <UButton :label="t('editor.actions.apply')" variant="soft" size="xs" block @click="applyAdjust" />
      </template>

      <!-- Keskinlik -->
      <template v-else-if="tool === 'sharpen'">
        <div class="space-y-1.5">
          <div class="flex justify-between">
            <span class="text-xs text-muted">{{ t('editor.params.amount') }}</span>
            <span class="text-xs tabular-nums text-muted">{{ sharpen.amount }}</span>
          </div>
          <USlider v-model="sharpen.amount" :min="0" :max="10" size="xs" />
        </div>
        <UButton :label="t('editor.actions.apply')" variant="soft" size="xs" block @click="applySharpen" />
      </template>

      <!-- Döndür -->
      <template v-else-if="tool === 'rotate'">
        <div class="space-y-1.5">
          <div class="flex justify-between">
            <span class="text-xs text-muted">{{ t('editor.params.angle') }}</span>
            <span class="text-xs tabular-nums text-muted">{{ rotate.angle }}°</span>
          </div>
          <USlider v-model="rotate.angle" :min="-180" :max="180" size="xs" />
        </div>
        <UButton :label="t('editor.actions.apply')" variant="soft" size="xs" block @click="applyRotate" />
      </template>

      <!-- Çevir -->
      <template v-else-if="tool === 'flip'">
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
      <template v-else-if="tool === 'grayscale'">
        <p class="text-xs text-muted leading-relaxed">
          {{ t('editor.tools.grayscale') }}
        </p>
        <UButton :label="t('editor.actions.apply')" variant="soft" size="xs" block @click="applyGrayscale" />
      </template>

      <!-- Boyutlandır -->
      <template v-else-if="tool === 'resize'">
        <div class="space-y-3">
          <p class="text-xs text-muted leading-relaxed">
            {{ t('editor.canvas.resizeHint') }}
          </p>
          <div>
            <p class="text-xs text-muted mb-1.5">
              {{ t('editor.params.width') }}
            </p>
            <UInput v-model.number="resize.width" type="number" size="xs" placeholder="px" />
          </div>
          <div>
            <p class="text-xs text-muted mb-1.5">
              {{ t('editor.params.height') }}
            </p>
            <UInput v-model.number="resize.height" type="number" size="xs" placeholder="px" />
          </div>
          <label class="flex items-center gap-2 cursor-pointer">
            <UCheckbox v-model="resize.keepAspect" size="xs" />
            <span class="text-xs text-muted">{{ t('editor.params.keepAspect') }}</span>
          </label>
        </div>
        <UButton :label="t('editor.actions.apply')" variant="soft" size="xs" block @click="applyResize" />
      </template>
    </div>
  </div>
</template>
