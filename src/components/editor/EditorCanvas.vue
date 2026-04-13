<script setup lang="ts">
import type { Layer, Operation } from '../../stores/editor'
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
const canvasEl = ref<HTMLCanvasElement | null>(null)

// ── VIEWPORT ─────────────────────────────────────────────────────
const zoom = ref(1)
const viewTx = ref(0)
const viewTy = ref(0)
const isPanning = ref(false)
const spaceHeld = ref(false)
const panStart = ref({ x: 0, y: 0, tx: 0, ty: 0 })

// ── INTERACTION DRAFT STATE ───────────────────────────────────────
const draftX = ref<number | null>(null)
const draftY = ref<number | null>(null)
const draftW = ref<number | null>(null)
const draftH = ref<number | null>(null)
const draftR = ref<number | null>(null)

type ResizeHandle = 'tl' | 'tc' | 'tr' | 'ml' | 'mr' | 'bl' | 'bc' | 'br'

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

// ── CONSTANTS ────────────────────────────────────────────────────
const DEG2RAD = Math.PI / 180
const HANDLE_PX = 8
const ROTATE_GAP = 28
const MIN_ZOOM = 0.02
const MAX_ZOOM = 30
const MIN_DIM = 10

// ── COMPUTED ─────────────────────────────────────────────────────
const canvasW = computed(() => editor.canvasWidth ?? 0)
const canvasH = computed(() => editor.canvasHeight ?? 0)
const showStage = computed(() =>
  editor.hasProject || !!(editor.layers.length > 0 && editor.layers[0]?.imageSrc),
)

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

// ── RAF RENDER LOOP ──────────────────────────────────────────────
// Declared early so watchers below can reference markDirty safely
const dpr = window.devicePixelRatio || 1
let ro: ResizeObserver | null = null
let rafId = 0
let dirty = false

function markDirty() {
  dirty = true
}

// ── IMAGE CACHE ──────────────────────────────────────────────────
const imageCache = new Map<string, HTMLImageElement>()

function getOrLoadImage(layer: Layer): HTMLImageElement | null {
  if (!layer.imageSrc)
    return null
  if (imageCache.has(layer.id))
    return imageCache.get(layer.id)!

  const img = new Image()
  img.onload = () => {
    imageCache.set(layer.id, img)
    if (layer.type === 'base') {
      editor.initBaseLayerFromImage(img.naturalWidth, img.naturalHeight)
      emit('imageSizeChange', img.naturalWidth, img.naturalHeight)
      fitToScreen()
    }
    markDirty()
  }
  img.onerror = () => console.error(`[EditorCanvas] Image load failed: layer ${layer.id}`)
  img.src = layer.imageSrc
  return null
}

// Cleanup cache when layers are removed and pre-load when imageSrc changes
watch(
  () => editor.layers.map(l => `${l.id}:${l.imageSrc ?? ''}`),
  (newVals, oldVals) => {
    // Remove stale cache entries for changed/removed layers
    if (oldVals) {
      const newIds = new Set(editor.layers.map(l => l.id))
      for (const entry of oldVals) {
        const id = entry.split(':')[0]
        if (!newIds.has(id))
          imageCache.delete(id)
      }
      // Invalidate cache for layers whose src changed
      for (let i = 0; i < newVals.length; i++) {
        if (oldVals[i] !== newVals[i]) {
          const id = editor.layers[i]?.id
          if (id)
            imageCache.delete(id)
        }
      }
    }
    // Pre-load images for all layers (even if canvas not ready to render yet)
    for (const layer of editor.layers) {
      if (layer.imageSrc && !imageCache.has(layer.id))
        getOrLoadImage(layer)
    }
    markDirty()
  },
  { immediate: true },
)

function setupCanvas() {
  if (!containerRef.value || !canvasEl.value)
    return
  const { clientWidth, clientHeight } = containerRef.value
  canvasEl.value.width = Math.round(clientWidth * dpr)
  canvasEl.value.height = Math.round(clientHeight * dpr)
  canvasEl.value.style.width = `${clientWidth}px`
  canvasEl.value.style.height = `${clientHeight}px`
  markDirty()
}

function scheduleRender() {
  rafId = requestAnimationFrame(() => {
    if (dirty) {
      render()
      dirty = false
    }
    scheduleRender()
  })
}

// ── CSS FILTER BUILDER ───────────────────────────────────────────
function buildCssFilter(ops: Operation[], pendingOp: Operation | null): string {
  const all = pendingOp ? [...ops, pendingOp] : ops
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
  const parts: string[] = []
  if (brightness !== 1)
    parts.push(`brightness(${brightness})`)
  if (contrast !== 1)
    parts.push(`contrast(${contrast})`)
  if (saturate !== 1)
    parts.push(`saturate(${saturate})`)
  if (grayscale)
    parts.push('grayscale(1)')
  return parts.length ? parts.join(' ') : 'none'
}

function getGeometricTransform(ops: Operation[], pendingOp: Operation | null) {
  const all = pendingOp ? [...ops, pendingOp] : ops
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
  return { deg, sx, sy }
}

// ── DRAFT HELPERS ────────────────────────────────────────────────
function effectiveX(layer: Layer): number {
  return (layer.id === editor.selectedLayerId && draftX.value !== null) ? draftX.value : layer.x
}
function effectiveY(layer: Layer): number {
  return (layer.id === editor.selectedLayerId && draftY.value !== null) ? draftY.value : layer.y
}
function effectiveW(layer: Layer): number {
  return (layer.id === editor.selectedLayerId && draftW.value !== null) ? draftW.value : layer.width
}
function effectiveH(layer: Layer): number {
  return (layer.id === editor.selectedLayerId && draftH.value !== null) ? draftH.value : layer.height
}
function effectiveR(layer: Layer): number {
  return (layer.id === editor.selectedLayerId && draftR.value !== null) ? draftR.value : layer.rotation
}

// ── RENDER ───────────────────────────────────────────────────────
function render() {
  const canvas = canvasEl.value
  if (!canvas)
    return
  const ctx = canvas.getContext('2d')
  if (!ctx)
    return

  const cw = canvasW.value
  const ch = canvasH.value

  ctx.clearRect(0, 0, canvas.width, canvas.height)

  if (!showStage.value || !cw || !ch)
    return

  ctx.save()
  ctx.scale(dpr, dpr)

  // ── 1. Workspace shadow + background ──────────────────────────
  const wsX = viewTx.value
  const wsY = viewTy.value
  const wsW = cw * zoom.value
  const wsH = ch * zoom.value
  const baseLayer = editor.layers.find(l => l.type === 'base')
  const bgColor = baseLayer?.backgroundColor ?? '#ffffff'

  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.5)'
  ctx.shadowBlur = 24
  ctx.shadowOffsetX = 0
  ctx.shadowOffsetY = 4
  ctx.fillStyle = bgColor
  ctx.fillRect(wsX, wsY, wsW, wsH)
  ctx.restore()

  // ── 2. Clip to canvas bounds and draw layers ───────────────────
  ctx.save()
  ctx.translate(viewTx.value, viewTy.value)
  ctx.scale(zoom.value, zoom.value)
  ctx.beginPath()
  ctx.rect(0, 0, cw, ch)
  ctx.clip()

  for (const layer of editor.layers) {
    if (!layer.visible)
      continue

    const lx = effectiveX(layer)
    const ly = effectiveY(layer)
    const lw = effectiveW(layer)
    const lh = effectiveH(layer)
    const lr = effectiveR(layer)

    ctx.save()
    ctx.globalAlpha = layer.opacity / 100

    // Center of this layer
    const cx = lx + lw / 2
    const cy = ly + lh / 2
    ctx.translate(cx, cy)

    if (layer.type === 'base') {
      // Apply CSS filter (brightness, contrast, etc.)
      const f = buildCssFilter(props.operations, props.pendingOp)
      ctx.filter = f

      // Apply geometric ops (rotate + flip from operations)
      const { deg, sx, sy } = getGeometricTransform(props.operations, props.pendingOp)
      const totalDeg = deg + lr
      if (totalDeg !== 0)
        ctx.rotate(totalDeg * DEG2RAD)
      if (sx !== 1 || sy !== 1)
        ctx.scale(sx, sy)
    }
    else {
      // Image layer: just apply layer rotation
      if (lr !== 0)
        ctx.rotate(lr * DEG2RAD)
    }

    const img = getOrLoadImage(layer)
    if (img) {
      ctx.drawImage(img, -lw / 2, -lh / 2, lw, lh)
    }

    // Reset filter after use
    if (layer.type === 'base')
      ctx.filter = 'none'

    ctx.restore()
  }

  ctx.restore() // end clip + viewport

  // ── 3. Selection handles (outside canvas clip) ─────────────────
  const sel = editor.selectedLayer
  if (sel && !spaceHeld.value) {
    ctx.save()
    ctx.translate(viewTx.value, viewTy.value)
    ctx.scale(zoom.value, zoom.value)
    drawHandles(ctx, sel)
    ctx.restore()
  }

  ctx.restore() // end dpr scale
}

// ── DRAW HANDLES ─────────────────────────────────────────────────
function drawHandles(ctx: CanvasRenderingContext2D, layer: Layer) {
  const lx = effectiveX(layer)
  const ly = effectiveY(layer)
  const lw = effectiveW(layer)
  const lh = effectiveH(layer)
  const lr = effectiveR(layer)

  // For base layer combine with operation rotation
  let totalRot = lr
  if (layer.type === 'base') {
    const { deg } = getGeometricTransform(props.operations, props.pendingOp)
    totalRot = deg + lr
  }

  const hsz = HANDLE_PX / zoom.value
  const lw1 = 1 / zoom.value
  const gap = ROTATE_GAP / zoom.value

  ctx.save()
  ctx.translate(lx + lw / 2, ly + lh / 2)
  ctx.rotate(totalRot * DEG2RAD)
  ctx.translate(-lw / 2, -lh / 2)

  // Selection rectangle
  ctx.save()
  ctx.strokeStyle = '#38bdf8'
  ctx.lineWidth = lw1
  ctx.setLineDash([4 / zoom.value, 3 / zoom.value])
  ctx.strokeRect(0, 0, lw, lh)
  ctx.setLineDash([])
  ctx.restore()

  // Skip resize/rotate handles for locked base layer
  if (layer.type === 'base') {
    ctx.restore()
    return
  }

  const handlePositions = [
    { x: 0, y: 0 },
    { x: lw / 2, y: 0 },
    { x: lw, y: 0 },
    { x: 0, y: lh / 2 },
    { x: lw, y: lh / 2 },
    { x: 0, y: lh },
    { x: lw / 2, y: lh },
    { x: lw, y: lh },
  ]

  for (const h of handlePositions) {
    ctx.fillStyle = '#ffffff'
    ctx.strokeStyle = '#38bdf8'
    ctx.lineWidth = lw1
    ctx.fillRect(h.x - hsz / 2, h.y - hsz / 2, hsz, hsz)
    ctx.strokeRect(h.x - hsz / 2, h.y - hsz / 2, hsz, hsz)
  }

  // Rotation line
  ctx.strokeStyle = '#38bdf8'
  ctx.lineWidth = lw1
  ctx.beginPath()
  ctx.moveTo(lw / 2, 0)
  ctx.lineTo(lw / 2, -gap)
  ctx.stroke()

  // Rotation handle circle
  ctx.beginPath()
  ctx.arc(lw / 2, -gap, (HANDLE_PX / 2) / zoom.value, 0, Math.PI * 2)
  ctx.fillStyle = '#ffffff'
  ctx.fill()
  ctx.strokeStyle = '#38bdf8'
  ctx.lineWidth = lw1
  ctx.stroke()

  ctx.restore()
}

// ── COORDINATE CONVERSION ────────────────────────────────────────
function screenToCanvas(e: MouseEvent): { x: number, y: number } {
  if (!containerRef.value)
    return { x: 0, y: 0 }
  const rect = containerRef.value.getBoundingClientRect()
  return {
    x: (e.clientX - rect.left - viewTx.value) / zoom.value,
    y: (e.clientY - rect.top - viewTy.value) / zoom.value,
  }
}

function getLocalPoint(cx: number, cy: number, layer: Layer): { x: number, y: number } {
  const lx = effectiveX(layer)
  const ly = effectiveY(layer)
  const lw = effectiveW(layer)
  const lh = effectiveH(layer)
  const lr = effectiveR(layer)
  let totalRot = lr
  if (layer.type === 'base') {
    const { deg } = getGeometricTransform(props.operations, props.pendingOp)
    totalRot = deg + lr
  }
  const dx = cx - (lx + lw / 2)
  const dy = cy - (ly + lh / 2)
  const rad = -totalRot * DEG2RAD
  return {
    x: dx * Math.cos(rad) - dy * Math.sin(rad) + lw / 2,
    y: dx * Math.sin(rad) + dy * Math.cos(rad) + lh / 2,
  }
}

// ── HIT TESTING ──────────────────────────────────────────────────
function hitTestLayers(cx: number, cy: number): Layer | null {
  for (let i = editor.layers.length - 1; i >= 0; i--) {
    const layer = editor.layers[i]
    if (!layer.visible)
      continue
    const local = getLocalPoint(cx, cy, layer)
    const lw = effectiveW(layer)
    const lh = effectiveH(layer)
    if (local.x >= 0 && local.x <= lw && local.y >= 0 && local.y <= lh)
      return layer
  }
  return null
}

type HitHandleResult
  = | { type: 'resize', handle: ResizeHandle }
    | { type: 'rotate' }
    | null

function hitTestHandles(cx: number, cy: number, layer: Layer): HitHandleResult {
  if (layer.type === 'base')
    return null
  const lw = effectiveW(layer)
  const lh = effectiveH(layer)
  const local = getLocalPoint(cx, cy, layer)
  const lx = local.x
  const ly = local.y
  const hitR = (HANDLE_PX / 2 + 4) / zoom.value

  const handles: Array<{ id: ResizeHandle, x: number, y: number }> = [
    { id: 'tl', x: 0, y: 0 },
    { id: 'tc', x: lw / 2, y: 0 },
    { id: 'tr', x: lw, y: 0 },
    { id: 'ml', x: 0, y: lh / 2 },
    { id: 'mr', x: lw, y: lh / 2 },
    { id: 'bl', x: 0, y: lh },
    { id: 'bc', x: lw / 2, y: lh },
    { id: 'br', x: lw, y: lh },
  ]

  for (const h of handles) {
    if (Math.abs(lx - h.x) < hitR && Math.abs(ly - h.y) < hitR)
      return { type: 'resize', handle: h.id }
  }

  // Rotation handle: at (lw/2, -ROTATE_GAP/zoom) in local space
  const rhx = lw / 2
  const rhy = -ROTATE_GAP / zoom.value
  if (Math.abs(lx - rhx) < hitR && Math.abs(ly - rhy) < hitR)
    return { type: 'rotate' }

  return null
}

// ── VIEWPORT ─────────────────────────────────────────────────────
function fitToScreen() {
  if (!containerRef.value || !canvasW.value || !canvasH.value)
    return
  const { clientWidth: cw, clientHeight: ch } = containerRef.value
  const fit = Math.min(cw / canvasW.value, ch / canvasH.value) * 0.9
  zoom.value = fit
  viewTx.value = (cw - canvasW.value * fit) / 2
  viewTy.value = (ch - canvasH.value * fit) / 2
  emit('zoomChange', fit)
  markDirty()
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
  markDirty()
}

function onWheel(e: WheelEvent) {
  e.preventDefault()
  if (!containerRef.value)
    return
  const rect = containerRef.value.getBoundingClientRect()
  setZoom(
    zoom.value * (e.deltaY < 0 ? 1.12 : 1 / 1.12),
    e.clientX - rect.left,
    e.clientY - rect.top,
  )
}

// ── PAN ──────────────────────────────────────────────────────────
function startPan(e: MouseEvent) {
  e.preventDefault()
  isPanning.value = true
  panStart.value = { x: e.clientX, y: e.clientY, tx: viewTx.value, ty: viewTy.value }
}

// ── MOUSE DISPATCHER ─────────────────────────────────────────────
function onMouseDown(e: MouseEvent) {
  if (spaceHeld.value || e.button === 1) {
    startPan(e)
    return
  }
  if (e.button !== 0)
    return

  const p = screenToCanvas(e)

  // Check handles on selected non-base layer first
  if (editor.selectedLayer && editor.selectedLayer.type !== 'base') {
    const hh = hitTestHandles(p.x, p.y, editor.selectedLayer)
    if (hh?.type === 'resize') {
      startResize(hh.handle)
      return
    }
    if (hh?.type === 'rotate') {
      startRotate(e)
      return
    }
  }

  // Layer hit test
  const hit = hitTestLayers(p.x, p.y)
  if (hit) {
    editor.selectLayer(hit.id)
    if (hit.type !== 'base') {
      layerDrag.value = {
        baseX: hit.x,
        baseY: hit.y,
        startX: p.x,
        startY: p.y,
      }
    }
  }
  else {
    editor.selectLayer(null)
  }
}

function onMouseMove(e: MouseEvent) {
  if (isPanning.value) {
    viewTx.value = panStart.value.tx + (e.clientX - panStart.value.x)
    viewTy.value = panStart.value.ty + (e.clientY - panStart.value.y)
    markDirty()
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

// ── MOVE ─────────────────────────────────────────────────────────
function doLayerMove(e: MouseEvent) {
  if (!layerDrag.value)
    return
  const p = screenToCanvas(e)
  draftX.value = layerDrag.value.baseX + (p.x - layerDrag.value.startX)
  draftY.value = layerDrag.value.baseY + (p.y - layerDrag.value.startY)
  markDirty()
}

function commitLayerMove() {
  const layer = editor.selectedLayer
  if (layer && draftX.value !== null && draftY.value !== null) {
    editor.updateLayer(layer.id, {
      x: Math.round(draftX.value),
      y: Math.round(draftY.value),
    })
  }
  layerDrag.value = null
  draftX.value = null
  draftY.value = null
}

// ── RESIZE ───────────────────────────────────────────────────────
function startResize(handle: ResizeHandle) {
  const layer = editor.selectedLayer
  if (!layer)
    return
  const def = anchorDef[handle]
  const lx = effectiveX(layer)
  const ly = effectiveY(layer)
  const lw = effectiveW(layer)
  const lh = effectiveH(layer)
  resizeDrag.value = {
    handle,
    baseW: lw,
    baseH: lh,
    baseX: lx,
    baseY: ly,
    anchorX: lx + def.ax * lw,
    anchorY: ly + def.ay * lh,
  }
}

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
  markDirty()
}

function commitResize() {
  const layer = editor.selectedLayer
  if (layer && draftW.value !== null && draftH.value !== null && draftX.value !== null && draftY.value !== null) {
    editor.updateLayer(layer.id, {
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

// ── ROTATE ───────────────────────────────────────────────────────
function startRotate(e: MouseEvent) {
  const layer = editor.selectedLayer
  if (!layer)
    return
  const lx = effectiveX(layer)
  const ly = effectiveY(layer)
  const lw = effectiveW(layer)
  const lh = effectiveH(layer)
  const center = { x: lx + lw / 2, y: ly + lh / 2 }
  const p = screenToCanvas(e)
  rotateDrag.value = {
    startPointerDeg: Math.atan2(p.y - center.y, p.x - center.x) * 180 / Math.PI,
    baseRotation: layer.rotation,
  }
}

function doRotateMove(e: MouseEvent) {
  if (!rotateDrag.value)
    return
  const layer = editor.selectedLayer
  if (!layer)
    return
  const lx = effectiveX(layer)
  const ly = effectiveY(layer)
  const lw = effectiveW(layer)
  const lh = effectiveH(layer)
  const center = { x: lx + lw / 2, y: ly + lh / 2 }
  const p = screenToCanvas(e)
  const angle = Math.atan2(p.y - center.y, p.x - center.x) * 180 / Math.PI
  draftR.value = rotateDrag.value.baseRotation + (angle - rotateDrag.value.startPointerDeg)
  markDirty()
}

function commitRotate() {
  const layer = editor.selectedLayer
  if (layer && draftR.value !== null)
    editor.updateLayer(layer.id, { rotation: Math.round(draftR.value) })
  rotateDrag.value = null
  draftR.value = null
}

// ── KEYBOARD ─────────────────────────────────────────────────────
function onKeyDown(e: KeyboardEvent) {
  if (e.code === 'Space' && !e.repeat) {
    e.preventDefault()
    spaceHeld.value = true
    markDirty()
  }
  if (e.code === 'Escape') {
    editor.selectLayer(null)
    markDirty()
  }
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
    markDirty()
  }
}

// ── CURSOR ───────────────────────────────────────────────────────
const cursorStyle = computed(() => {
  if (isPanning.value)
    return 'grabbing'
  if (spaceHeld.value)
    return 'grab'
  if (layerDrag.value)
    return 'grabbing'
  if (rotateDrag.value)
    return 'crosshair'
  return 'default'
})

// ── WATCHERS FOR DIRTY ───────────────────────────────────────────
watch([zoom, viewTx, viewTy], markDirty)
watch(() => editor.layers, markDirty, { deep: true })
watch(() => editor.selectedLayerId, markDirty)
watch(() => props.operations, markDirty, { deep: true })
watch(() => props.pendingOp, markDirty, { deep: true })
watch([canvasW, canvasH], ([w, h]) => {
  if (w && h)
    emit('imageSizeChange', w, h)
  markDirty()
})

// ── LIFECYCLE ────────────────────────────────────────────────────
onMounted(() => {
  setupCanvas()

  ro = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const { width, height } = entry.contentRect
      if (!canvasEl.value)
        continue
      canvasEl.value.width = Math.round(width * dpr)
      canvasEl.value.height = Math.round(height * dpr)
      canvasEl.value.style.width = `${width}px`
      canvasEl.value.style.height = `${height}px`
      markDirty()
    }
    if (editor.hasProject && zoom.value === 1)
      fitToScreen()
  })
  if (containerRef.value)
    ro.observe(containerRef.value)

  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  window.addEventListener('mouseup', onMouseUp)
  window.addEventListener('mousemove', onMouseMove)

  scheduleRender()
})

onUnmounted(() => {
  cancelAnimationFrame(rafId)
  ro?.disconnect()
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('keyup', onKeyUp)
  window.removeEventListener('mouseup', onMouseUp)
  window.removeEventListener('mousemove', onMouseMove)
})
</script>

<template>
  <div
    ref="containerRef"
    class="flex-1 overflow-hidden relative select-none dark:bg-neutral-950 bg-accented"
    :style="{ cursor: cursorStyle }"
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

    <!-- Canvas rendering surface (pointer-events disabled — hit div handles events) -->
    <canvas
      ref="canvasEl"
      class="absolute inset-0"
      style="pointer-events: none;"
    />

    <!-- Invisible hit surface for pointer events -->
    <div
      class="absolute inset-0"
      @wheel.prevent="onWheel"
      @mousedown="onMouseDown"
    />
  </div>
</template>
