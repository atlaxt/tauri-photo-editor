<script setup lang="ts">
import type { Operation } from '../../stores/editor'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useEditorStore } from '../../stores/editor'

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
const editor = useEditorStore()

const containerRef = ref<HTMLDivElement | null>(null)
const imageUrl = ref<string | null>(null)
const imgNaturalW = ref(0)
const imgNaturalH = ref(0)

// Kamera (viewport) transformu
const zoom = ref(1)
const viewTx = ref(0)
const viewTy = ref(0)

const isPanning = ref(false)
const spaceHeld = ref(false)
const panStart = ref({ x: 0, y: 0, tx: 0, ty: 0 })

const isSelected = computed(() =>
  !!(displayLayer.value && editor.selectedLayerId === displayLayer.value.id),
)

type ResizeHandle = 'tl' | 'tc' | 'tr' | 'ml' | 'mr' | 'bl' | 'bc' | 'br'

const anchorDef: Record<ResizeHandle, { ax: number, ay: number, affectsW: boolean, affectsH: boolean }> = {
  tl: { ax: 1, ay: 1, affectsW: true, affectsH: true },
  tc: { ax: 0.5, ay: 1, affectsW: false, affectsH: true },
  tr: { ax: 0, ay: 1, affectsW: true, affectsH: true },
  ml: { ax: 1, ay: 0.5, affectsW: true, affectsH: false },
  mr: { ax: 0, ay: 0.5, affectsW: true, affectsH: false },
  bl: { ax: 1, ay: 0, affectsW: true, affectsH: true },
  bc: { ax: 0.5, ay: 0, affectsW: false, affectsH: true },
  br: { ax: 0, ay: 0, affectsW: true, affectsH: true },
}

interface LayerDragState {
  baseX: number
  baseY: number
  startX: number
  startY: number
}

interface ResizeDragState {
  handle: ResizeHandle
  baseW: number
  baseH: number
  baseX: number
  baseY: number
  anchorX: number
  anchorY: number
}

interface RotateDragState {
  startPointerDeg: number
  baseRotation: number
}

const layerDrag = ref<LayerDragState | null>(null)
const resizeDrag = ref<ResizeDragState | null>(null)
const rotateDrag = ref<RotateDragState | null>(null)

const draftX = ref<number | null>(null)
const draftY = ref<number | null>(null)
const draftW = ref<number | null>(null)
const draftH = ref<number | null>(null)
const draftRotationDeg = ref<number | null>(null)

const displayLayer = computed(() => editor.layers[0] ?? null)

const canvasW = computed(() => editor.canvasWidth ?? 0)
const canvasH = computed(() => editor.canvasHeight ?? 0)
const stageW = computed(() => canvasW.value || imgNaturalW.value || 1)
const stageH = computed(() => canvasH.value || imgNaturalH.value || 1)
const showStage = computed(() => !!(editor.hasProject || imageUrl.value))

const curX = computed(() => draftX.value ?? displayLayer.value?.x ?? 0)
const curY = computed(() => draftY.value ?? displayLayer.value?.y ?? 0)
const curW = computed(() => draftW.value ?? displayLayer.value?.width ?? imgNaturalW.value)
const curH = computed(() => draftH.value ?? displayLayer.value?.height ?? imgNaturalH.value)
const curRotation = computed(() => draftRotationDeg.value ?? displayLayer.value?.rotation ?? 0)

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

watch([() => editor.canvasWidth, () => editor.canvasHeight], ([w, h]) => {
  if (w && h) {
    emit('imageSizeChange', w, h)
    fitToScreen()
  }
}, { immediate: true })

function onImageLoad(e: Event) {
  const img = e.target as HTMLImageElement
  imgNaturalW.value = img.naturalWidth
  imgNaturalH.value = img.naturalHeight
  editor.initBaseLayerFromImage(img.naturalWidth, img.naturalHeight)
  if (!editor.selectedLayerId)
    editor.selectLayer('base')
  fitToScreen()
}

const MIN_ZOOM = 0.02
const MAX_ZOOM = 30

function fitToScreen() {
  if (!containerRef.value || !canvasW.value || !canvasH.value)
    return
  const { clientWidth: cw, clientHeight: ch } = containerRef.value
  const fit = Math.min(cw / canvasW.value, ch / canvasH.value) * 0.9
  zoom.value = fit
  viewTx.value = (cw - canvasW.value * fit) / 2
  viewTy.value = (ch - canvasH.value * fit) / 2
  emit('zoomChange', fit)
}

function setZoom(newZoom: number, ox?: number, oy?: number) {
  newZoom = Math.min(Math.max(newZoom, MIN_ZOOM), MAX_ZOOM)
  if (!containerRef.value) {
    zoom.value = newZoom
    return
  }
  const { clientWidth: cw, clientHeight: ch } = containerRef.value
  const pivotX = ox ?? cw / 2
  const pivotY = oy ?? ch / 2
  viewTx.value = pivotX - (pivotX - viewTx.value) * newZoom / zoom.value
  viewTy.value = pivotY - (pivotY - viewTy.value) * newZoom / zoom.value
  zoom.value = newZoom
  emit('zoomChange', newZoom)
}

function onWheel(e: WheelEvent) {
  e.preventDefault()
  if (!containerRef.value)
    return
  const rect = containerRef.value.getBoundingClientRect()
  setZoom(zoom.value * (e.deltaY < 0 ? 1.12 : 1 / 1.12), e.clientX - rect.left, e.clientY - rect.top)
}

function startPan(e: MouseEvent) {
  e.preventDefault()
  isPanning.value = true
  panStart.value = { x: e.clientX, y: e.clientY, tx: viewTx.value, ty: viewTy.value }
}

function screenToCanvas(e: MouseEvent) {
  if (!containerRef.value)
    return { x: 0, y: 0 }
  const rect = containerRef.value.getBoundingClientRect()
  return {
    x: (e.clientX - rect.left - viewTx.value) / zoom.value,
    y: (e.clientY - rect.top - viewTy.value) / zoom.value,
  }
}

function onContainerMouseDown(e: MouseEvent) {
  if (spaceHeld.value || e.button === 1) {
    startPan(e)
    return
  }
  if (e.button === 0)
    editor.selectLayer(null)
}

function onLayerMouseDown(e: MouseEvent) {
  e.stopPropagation()
  if (spaceHeld.value || e.button === 1) {
    startPan(e)
    return
  }
  if (!displayLayer.value || e.button !== 0)
    return
  editor.selectLayer(displayLayer.value.id)
  const p = screenToCanvas(e)
  layerDrag.value = {
    baseX: displayLayer.value.x,
    baseY: displayLayer.value.y,
    startX: p.x,
    startY: p.y,
  }
}

function onMouseMove(e: MouseEvent) {
  if (isPanning.value) {
    viewTx.value = panStart.value.tx + (e.clientX - panStart.value.x)
    viewTy.value = panStart.value.ty + (e.clientY - panStart.value.y)
    return
  }
  if (layerDrag.value) {
    doLayerMove(e)
    return
  }
  if (resizeDrag.value) {
    doResizeMove(e)
    return
  }
  if (rotateDrag.value)
    doRotateMove(e)
}

function onMouseUp() {
  if (isPanning.value) {
    isPanning.value = false
    return
  }
  if (layerDrag.value) {
    commitLayerMove()
    return
  }
  if (resizeDrag.value) {
    commitResize()
    return
  }
  if (rotateDrag.value)
    commitRotate()
}

function doLayerMove(e: MouseEvent) {
  if (!layerDrag.value)
    return
  const p = screenToCanvas(e)
  draftX.value = layerDrag.value.baseX + (p.x - layerDrag.value.startX)
  draftY.value = layerDrag.value.baseY + (p.y - layerDrag.value.startY)
}

function commitLayerMove() {
  if (displayLayer.value && draftX.value !== null && draftY.value !== null) {
    editor.updateLayer(displayLayer.value.id, {
      x: Math.round(draftX.value),
      y: Math.round(draftY.value),
    })
  }
  layerDrag.value = null
  draftX.value = null
  draftY.value = null
}

function startResize(handle: ResizeHandle, _e: MouseEvent) {
  if (!displayLayer.value)
    return
  const def = anchorDef[handle]
  resizeDrag.value = {
    handle,
    baseW: curW.value,
    baseH: curH.value,
    baseX: curX.value,
    baseY: curY.value,
    anchorX: curX.value + def.ax * curW.value,
    anchorY: curY.value + def.ay * curH.value,
  }
}

const MIN_DIM = 10

function doResizeMove(e: MouseEvent) {
  if (!resizeDrag.value)
    return
  const { handle, baseW, baseH, baseX, baseY, anchorX, anchorY } = resizeDrag.value
  const def = anchorDef[handle]
  const p = screenToCanvas(e)

  let newW = baseW
  let newH = baseH
  let newX = baseX
  let newY = baseY

  if (def.affectsW) {
    if (def.ax === 1) {
      newW = Math.max(MIN_DIM, anchorX - p.x)
      newX = anchorX - newW
    }
    else {
      newW = Math.max(MIN_DIM, p.x - anchorX)
      newX = anchorX
    }
  }

  if (def.affectsH) {
    if (def.ay === 1) {
      newH = Math.max(MIN_DIM, anchorY - p.y)
      newY = anchorY - newH
    }
    else {
      newH = Math.max(MIN_DIM, p.y - anchorY)
      newY = anchorY
    }
  }

  draftW.value = newW
  draftH.value = newH
  draftX.value = newX
  draftY.value = newY
}

function commitResize() {
  if (displayLayer.value && draftW.value !== null && draftH.value !== null && draftX.value !== null && draftY.value !== null) {
    editor.updateLayer(displayLayer.value.id, {
      width: Math.max(1, Math.round(draftW.value)),
      height: Math.max(1, Math.round(draftH.value)),
      x: Math.round(draftX.value),
      y: Math.round(draftY.value),
    })
  }
  resizeDrag.value = null
  draftW.value = null
  draftH.value = null
  draftX.value = null
  draftY.value = null
}

function getLayerCenter() {
  return {
    x: curX.value + curW.value / 2,
    y: curY.value + curH.value / 2,
  }
}

function startRotate(e: MouseEvent) {
  if (!displayLayer.value)
    return
  const c = getLayerCenter()
  const p = screenToCanvas(e)
  rotateDrag.value = {
    startPointerDeg: Math.atan2(p.y - c.y, p.x - c.x) * 180 / Math.PI,
    baseRotation: displayLayer.value.rotation,
  }
}

function doRotateMove(e: MouseEvent) {
  if (!rotateDrag.value)
    return
  const c = getLayerCenter()
  const p = screenToCanvas(e)
  const angle = Math.atan2(p.y - c.y, p.x - c.x) * 180 / Math.PI
  draftRotationDeg.value = rotateDrag.value.baseRotation + (angle - rotateDrag.value.startPointerDeg)
}

function commitRotate() {
  if (displayLayer.value && draftRotationDeg.value !== null)
    editor.updateLayer(displayLayer.value.id, { rotation: Math.round(draftRotationDeg.value) })
  rotateDrag.value = null
  draftRotationDeg.value = null
}

function onKeyDown(e: KeyboardEvent) {
  if (e.code === 'Space' && !e.repeat) {
    e.preventDefault()
    spaceHeld.value = true
  }
  if (e.code === 'Escape')
    editor.selectLayer(null)
  if ((e.metaKey || e.ctrlKey) && e.key === '0') {
    e.preventDefault()
    fitToScreen()
  }
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

const cssFilter = computed(() => {
  const all = props.pendingOp ? [...props.operations, props.pendingOp] : props.operations
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
  return [`brightness(${brightness})`, `contrast(${contrast})`, `saturate(${saturate})`, grayscale ? 'grayscale(1)' : ''].filter(Boolean).join(' ') || 'none'
})

const cssImageTransform = computed(() => {
  const all = props.pendingOp ? [...props.operations, props.pendingOp] : props.operations
  let deg = 0
  let sx = 1
  let sy = 1
  for (const op of all) {
    if (op.op === 'rotate')
      deg = (deg + (op.params.value as number)) % 360
    if (op.op === 'flip_horizontal')
      sx *= -1
    if (op.op === 'flip_vertical')
      sy *= -1
  }
  return `rotate(${deg + curRotation.value}deg) scaleX(${sx}) scaleY(${sy})`
})

const cursorStyle = computed(() => {
  if (isPanning.value)
    return 'grabbing'
  if (spaceHeld.value)
    return 'grab'
  if (layerDrag.value)
    return 'grabbing'
  if (rotateDrag.value)
    return 'crosshair'
  if (displayLayer.value)
    return 'default'
  return 'default'
})

const HANDLE_PX = 8
const ROTATE_GAP = 28

const resizeHandles = [
  { id: 'tl' as ResizeHandle, xf: 0, yf: 0, cursor: 'nwse-resize' },
  { id: 'tc' as ResizeHandle, xf: 0.5, yf: 0, cursor: 'ns-resize' },
  { id: 'tr' as ResizeHandle, xf: 1, yf: 0, cursor: 'nesw-resize' },
  { id: 'ml' as ResizeHandle, xf: 0, yf: 0.5, cursor: 'ew-resize' },
  { id: 'mr' as ResizeHandle, xf: 1, yf: 0.5, cursor: 'ew-resize' },
  { id: 'bl' as ResizeHandle, xf: 0, yf: 1, cursor: 'nesw-resize' },
  { id: 'bc' as ResizeHandle, xf: 0.5, yf: 1, cursor: 'ns-resize' },
  { id: 'br' as ResizeHandle, xf: 1, yf: 1, cursor: 'nwse-resize' },
]

function getHandleStyle(h: typeof resizeHandles[number]) {
  const sz = HANDLE_PX / zoom.value
  return {
    position: 'absolute' as const,
    left: `${h.xf * curW.value - sz / 2}px`,
    top: `${h.yf * curH.value - sz / 2}px`,
    width: `${sz}px`,
    height: `${sz}px`,
    cursor: h.cursor,
    zIndex: 20,
    boxSizing: 'border-box' as const,
  }
}

const selectionBorderStyle = computed(() => {
  const bw = 1 / zoom.value
  return {
    position: 'absolute' as const,
    inset: `${-bw}px`,
    border: `${bw}px solid rgb(56 189 248)`,
    pointerEvents: 'none' as const,
    boxSizing: 'border-box' as const,
    zIndex: 10,
  }
})

const rotateLineStyle = computed(() => {
  const dist = ROTATE_GAP / zoom.value
  const lw = 1 / zoom.value
  return {
    position: 'absolute' as const,
    left: `${curW.value / 2 - lw / 2}px`,
    top: `${-dist}px`,
    width: `${lw}px`,
    height: `${dist}px`,
    backgroundColor: 'rgb(56 189 248)',
    pointerEvents: 'none' as const,
    zIndex: 15,
  }
})

const rotateHandleStyle = computed(() => {
  const sz = HANDLE_PX / zoom.value
  const dist = ROTATE_GAP / zoom.value
  return {
    position: 'absolute' as const,
    left: `${curW.value / 2 - sz / 2}px`,
    top: `${-dist - sz / 2}px`,
    width: `${sz}px`,
    height: `${sz}px`,
    cursor: 'crosshair',
    zIndex: 20,
    boxSizing: 'border-box' as const,
    borderRadius: '50%',
  }
})

const stageStyle = computed(() => ({
  position: 'absolute' as const,
  top: 0,
  left: 0,
  width: `${stageW.value}px`,
  height: `${stageH.value}px`,
  transformOrigin: '0 0',
  transform: `translate(${viewTx.value}px, ${viewTy.value}px) scale(${zoom.value})`,
  backgroundColor: '#202020',
  boxShadow: '0 8px 30px rgba(0, 0, 0, 0.45)',
  overflow: 'hidden',
}))

const layerStyle = computed(() => ({
  position: 'absolute' as const,
  left: `${curX.value}px`,
  top: `${curY.value}px`,
  width: `${curW.value}px`,
  height: `${curH.value}px`,
  cursor: layerDrag.value ? 'grabbing' : 'move',
}))

const isDragging = computed(() => !!(layerDrag.value || resizeDrag.value || rotateDrag.value))
</script>

<template>
  <div
    ref="containerRef"
    class="flex-1 overflow-hidden relative select-none dark:bg-neutral-950 bg-accented"
    :style="{ cursor: cursorStyle }"
    @wheel.prevent="onWheel"
    @mousedown="onContainerMouseDown"
  >
    <div v-if="!showStage" class="absolute inset-0 flex flex-col items-center justify-center gap-2">
      <UIcon name="i-ph-image" class="size-10 opacity-20 text-muted" />
      <p class="text-sm text-muted opacity-40">
        {{ t('editor.canvas.noFile') }}
      </p>
      <p class="text-xs text-muted opacity-25">
        {{ t('editor.canvas.noFileHint') }}
      </p>
    </div>

    <div v-else :style="stageStyle">
      <div
        v-if="imageUrl && displayLayer && displayLayer.visible"
        :style="layerStyle"
        @mousedown.stop="onLayerMouseDown"
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
            opacity: String(displayLayer.opacity / 100),
            userSelect: 'none',
          }"
          draggable="false"
          @load="onImageLoad"
        >

        <template v-if="isSelected && !spaceHeld">
          <div :style="selectionBorderStyle" />

          <template v-if="!isDragging">
            <div
              v-for="h in resizeHandles"
              :key="h.id"
              :style="getHandleStyle(h)"
              class="absolute bg-white border border-sky-400"
              style="box-shadow: 0 1px 3px rgba(0,0,0,0.3);"
              @mousedown.stop.prevent="startResize(h.id, $event)"
            />

            <div :style="rotateLineStyle" />

            <div
              :style="rotateHandleStyle"
              class="absolute bg-white border border-sky-400"
              style="box-shadow: 0 1px 3px rgba(0,0,0,0.3);"
              @mousedown.stop.prevent="startRotate($event)"
            />
          </template>
        </template>
      </div>

      <div
        v-else
        class="absolute inset-0 flex items-center justify-center"
      >
        <p class="text-xs text-white/45">
          {{ t('editor.canvas.emptyProject') }}
        </p>
      </div>
    </div>
  </div>
</template>
