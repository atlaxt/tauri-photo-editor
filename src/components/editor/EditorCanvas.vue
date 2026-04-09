<script setup lang="ts">
import type { Operation } from '../../stores/editor'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  filePath: string | null
  operations: Operation[]
  pendingOp: Operation | null
}>()

const emit = defineEmits<{
  imageSizeChange: [width: number, height: number]
}>()

const { t } = useI18n()

function onImageLoad(e: Event) {
  const img = e.target as HTMLImageElement
  emit('imageSizeChange', img.naturalWidth, img.naturalHeight)
}

// Tauri'de dosya yolunu webview URL'ye çevir
const imageUrl = ref<string | null>(null)

watch(() => props.filePath, async (path) => {
  if (!path) { imageUrl.value = null; return }
  try {
    const { convertFileSrc } = await import('@tauri-apps/api/core')
    imageUrl.value = convertFileSrc(path)
  }
  catch {
    // Tarayıcıda doğrudan kullan (geliştirme)
    imageUrl.value = path
  }
}, { immediate: true })

// Tüm işlemleri + pending op'u CSS filter/transform'a çevir
const cssFilter = computed(() => {
  const all = props.pendingOp
    ? [...props.operations, props.pendingOp]
    : props.operations

  let brightness = 1
  let contrast = 1
  let saturate = 1
  let grayscale = 0
  const sharpen = 0 // CSS'te blur ile yaklaşık — gerçek keskinlik Rust'ta

  for (const op of all) {
    if (op.op === 'brightness')
      brightness = 1 + (op.params.value as number) / 100
    if (op.op === 'contrast')
      contrast = 1 + (op.params.value as number) / 100
    if (op.op === 'saturation')
      saturate = 1 + (op.params.value as number) / 100
    if (op.op === 'grayscale')
      grayscale = 1
  }

  const parts = [
    `brightness(${brightness})`,
    `contrast(${contrast})`,
    `saturate(${saturate})`,
    grayscale ? 'grayscale(1)' : '',
  ].filter(Boolean)

  return parts.join(' ') || 'none'
})

const cssTransform = computed(() => {
  const all = props.pendingOp
    ? [...props.operations, props.pendingOp]
    : props.operations

  let deg = 0
  let scaleX = 1
  let scaleY = 1

  for (const op of all) {
    if (op.op === 'rotate')
      deg = (deg + (op.params.value as number)) % 360
    if (op.op === 'flip_horizontal')
      scaleX *= -1
    if (op.op === 'flip_vertical')
      scaleY *= -1
  }

  return `rotate(${deg}deg) scaleX(${scaleX}) scaleY(${scaleY})`
})
</script>

<template>
  <div class="flex-1 flex items-center justify-center bg-[var(--ui-bg-muted)] overflow-hidden">
    <!-- Resim yoksa boş durum -->
    <div v-if="!imageUrl" class="flex flex-col items-center gap-2 text-muted">
      <UIcon name="i-ph-image" class="size-10 opacity-30" />
      <p class="text-sm">
        {{ t('editor.canvas.noFile') }}
      </p>
      <p class="text-xs opacity-60">
        {{ t('editor.canvas.noFileHint') }}
      </p>
    </div>

    <!-- Resim -->
    <img
      v-else
      :src="imageUrl"
      :style="{ filter: cssFilter, transform: cssTransform }"
      class="max-w-full max-h-full object-contain select-none transition-[filter,transform] duration-150"
      draggable="false"
      @load="onImageLoad"
    >
  </div>
</template>
