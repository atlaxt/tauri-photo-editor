<script setup lang="ts">
import type { Operation } from '../../stores/editor'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  filePath: string | null
  operations: Operation[]
  pendingOp: Operation | null
}>()

const emit = defineEmits<{
  imageSizeChange: [width: number, height: number]
  zoomChange: [zoom: number]
}>()

const { t } = useI18n()

const containerRef = ref<HTMLDivElement | null>(null)
const imageUrl = ref<string | null>(null)
const imgNaturalW = ref(0)
const imgNaturalH = ref(0)

// Viewport state
const zoom = ref(1)
const tx = ref(0)
const ty = ref(0)

// Pan state
const isPanning = ref(false)
const spaceHeld = ref(false)
const panStart = ref({ x: 0, y: 0, tx: 0, ty: 0 })

// ─── File URL ──────────────────────────────────────────────────────────────

watch(() => props.filePath, async (path) => {
  if (!path) {
    imageUrl.value = null
    imgNaturalW.value = 0
    imgNaturalH.value = 0
    return
  }
  try {
    const { convertFileSrc } = await import('@tauri-apps/api/core')
    imageUrl.value = convertFileSrc(path)
  }
  catch {
    imageUrl.value = path
  }
}, { immediate: true })

// ─── Image load ────────────────────────────────────────────────────────────

function onImageLoad(e: Event) {
  const img = e.target as HTMLImageElement
  imgNaturalW.value = img.naturalWidth
  imgNaturalH.value = img.naturalHeight
  emit('imageSizeChange', img.naturalWidth, img.naturalHeight)
  fitToScreen()
}

// ─── Zoom / fit ────────────────────────────────────────────────────────────

const MIN_ZOOM = 0.02
const MAX_ZOOM = 30

function fitToScreen() {
  if (!containerRef.value || !imgNaturalW.value || !imgNaturalH.value)
    return
  const { clientWidth: cw, clientHeight: ch } = containerRef.value
  const fit = Math.min(cw / imgNaturalW.value, ch / imgNaturalH.value) * 0.9
  zoom.value = fit
  tx.value = (cw - imgNaturalW.value * fit) / 2
  ty.value = (ch - imgNaturalH.value * fit) / 2
  emit('zoomChange', fit)
}

function setZoom(newZoom: number, originX?: number, originY?: number) {
  newZoom = Math.min(Math.max(newZoom, MIN_ZOOM), MAX_ZOOM)
  if (!containerRef.value) {
    zoom.value = newZoom
    return
  }

  const { clientWidth: cw, clientHeight: ch } = containerRef.value
  const ox = originX ?? cw / 2
  const oy = originY ?? ch / 2

  tx.value = ox - (ox - tx.value) * newZoom / zoom.value
  ty.value = oy - (oy - ty.value) * newZoom / zoom.value
  zoom.value = newZoom
  emit('zoomChange', newZoom)
}

// ─── Wheel zoom ────────────────────────────────────────────────────────────

function onWheel(e: WheelEvent) {
  e.preventDefault()
  if (!containerRef.value)
    return
  const rect = containerRef.value.getBoundingClientRect()
  const mx = e.clientX - rect.left
  const my = e.clientY - rect.top
  const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12
  setZoom(zoom.value * factor, mx, my)
}

// ─── Pan ───────────────────────────────────────────────────────────────────

function onMouseDown(e: MouseEvent) {
  if (spaceHeld.value || e.button === 1) {
    e.preventDefault()
    isPanning.value = true
    panStart.value = { x: e.clientX, y: e.clientY, tx: tx.value, ty: ty.value }
  }
}

function onMouseMove(e: MouseEvent) {
  if (!isPanning.value)
    return
  tx.value = panStart.value.tx + (e.clientX - panStart.value.x)
  ty.value = panStart.value.ty + (e.clientY - panStart.value.y)
}

function onMouseUp() {
  isPanning.value = false
}

// ─── Keyboard ──────────────────────────────────────────────────────────────

function onKeyDown(e: KeyboardEvent) {
  if (e.code === 'Space' && !e.repeat) {
    e.preventDefault()
    spaceHeld.value = true
  }
  // Fit: Cmd/Ctrl + 0
  if ((e.metaKey || e.ctrlKey) && e.key === '0') {
    e.preventDefault()
    fitToScreen()
  }
  // 100%: Cmd/Ctrl + 1
  if ((e.metaKey || e.ctrlKey) && e.key === '1') {
    e.preventDefault()
    setZoom(1)
  }
}

function onKeyUp(e: KeyboardEvent) {
  if (e.code === 'Space') {
    spaceHeld.value = false
    isPanning.value = false
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  window.addEventListener('mouseup', onMouseUp)
  window.addEventListener('mousemove', onMouseMove)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('keyup', onKeyUp)
  window.removeEventListener('mouseup', onMouseUp)
  window.removeEventListener('mousemove', onMouseMove)
})

// ─── CSS filter / transform (işlem önizlemesi) ─────────────────────────────

const cssFilter = computed(() => {
  const all = props.pendingOp
    ? [...props.operations, props.pendingOp]
    : props.operations

  let brightness = 1
  let contrast = 1
  let saturate = 1
  let grayscale = 0

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

  return [
    `brightness(${brightness})`,
    `contrast(${contrast})`,
    `saturate(${saturate})`,
    grayscale ? 'grayscale(1)' : '',
  ].filter(Boolean).join(' ') || 'none'
})

const cssImageTransform = computed(() => {
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

const cursorStyle = computed(() => {
  if (isPanning.value)
    return 'grabbing'
  if (spaceHeld.value)
    return 'grab'
  return 'default'
})
</script>

<template>
  <div
    ref="containerRef"
    class="flex-1 overflow-hidden relative select-none dark:bg-neutral-950 bg-accented"
    :style="{ cursor: cursorStyle }"
    @wheel.prevent="onWheel"
    @mousedown="onMouseDown"
  >
    <!-- Dosya yoksa boş durum -->
    <div
      v-if="!imageUrl"
      class="absolute inset-0 flex flex-col items-center justify-center gap-2"
    >
      <UIcon name="i-ph-image" class="size-10 opacity-20 text-muted" />
      <p class="text-sm text-muted opacity-40">
        {{ t('editor.canvas.noFile') }}
      </p>
      <p class="text-xs text-muted opacity-25">
        {{ t('editor.canvas.noFileHint') }}
      </p>
    </div>

    <!-- Pan + zoom wrapper: sadece resim boyutunda, checkerboard buraya -->
    <div
      v-else
      :style="{
        position: 'absolute',
        top: 0,
        left: 0,
        transformOrigin: '0 0',
        transform: `translate(${tx}px, ${ty}px) scale(${zoom})`,
        willChange: 'transform',
        width: `${imgNaturalW}px`,
        height: `${imgNaturalH}px`,
        backgroundColor: '#808080',
        backgroundImage: `
          linear-gradient(45deg, #6b6b6b 25%, transparent 25%),
          linear-gradient(-45deg, #6b6b6b 25%, transparent 25%),
          linear-gradient(45deg, transparent 75%, #6b6b6b 75%),
          linear-gradient(-45deg, transparent 75%, #6b6b6b 75%)
        `,
        backgroundSize: '16px 16px',
        backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
      }"
    >
      <img
        :src="imageUrl"
        :style="{
          display: 'block',
          width: '100%',
          height: '100%',
          filter: cssFilter,
          transform: cssImageTransform,
          transformOrigin: 'center',
        }"
        draggable="false"
        @load="onImageLoad"
      >
    </div>
  </div>
</template>
