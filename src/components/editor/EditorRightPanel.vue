<script setup lang="ts">
import { onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import EditorPanelTabContent from './EditorPanelTabContent.vue'

const props = defineProps<{
  imageWidth: number | null
  imageHeight: number | null
  imageUrl: string | null
}>()

const { t } = useI18n()

// ─── Types ──────────────────────────────────────────────────────────────────

type TabId = 'layers' | 'history' | 'info' | 'histogram'

interface Pane {
  id: string
  tabs: TabId[]
  activeTab: TabId
}

const TAB_DEFS: Record<TabId, { icon: string, labelKey: string }> = {
  layers: { icon: 'i-ph-stack', labelKey: 'editor.panel.layers' },
  history: { icon: 'i-ph-clock-counter-clockwise', labelKey: 'editor.panel.history' },
  info: { icon: 'i-ph-info', labelKey: 'editor.panel.info' },
  histogram: { icon: 'i-ph-chart-bar', labelKey: 'editor.panel.histogram' },
}

const TAB_BAR_H = 36

// ─── Pane state ──────────────────────────────────────────────────────────────

let _uid = 0
const uid = () => `pane-${++_uid}`

const panes = ref<Pane[]>([
  { id: uid(), tabs: ['layers', 'info', 'histogram'], activeTab: 'layers' },
  { id: uid(), tabs: ['history'], activeTab: 'history' },
])
const paneSizes = ref<number[]>([60, 40])

// ─── Drag state ──────────────────────────────────────────────────────────────

const dragTab = ref<TabId | null>(null)
const dragSourcePaneId = ref<string | null>(null)
const dropPaneId = ref<string | null>(null)
const dropZone = ref<'tabbar' | 'top' | 'bottom' | null>(null)

// Her pane'in DOM referansı — koordinat tespiti için
const paneEls = ref<Map<string, HTMLElement>>(new Map())

function setPaneEl(paneId: string, el: HTMLElement | null) {
  if (el)
    paneEls.value.set(paneId, el)
  else paneEls.value.delete(paneId)
}

function onTabDragStart(tab: TabId, paneId: string, e: DragEvent) {
  dragTab.value = tab
  dragSourcePaneId.value = paneId
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
    // Bazı browser'lar veri olmadan drop izni vermiyor
    e.dataTransfer.setData('text/plain', tab)
  }
}

function onTabDragEnd() {
  dragTab.value = null
  dragSourcePaneId.value = null
  dropPaneId.value = null
  dropZone.value = null
}

// Aside seviyesinde tek dragover — child elementler devre dışı
function onAsideDragOver(e: DragEvent) {
  e.preventDefault()
  if (!dragTab.value || !e.dataTransfer)
    return
  e.dataTransfer.dropEffect = 'move'

  // Hangi pane'in üzerindeyiz? Y koordinatına göre bul
  for (const pane of panes.value) {
    const el = paneEls.value.get(pane.id)
    if (!el)
      continue
    const rect = el.getBoundingClientRect()
    if (e.clientY < rect.top || e.clientY > rect.bottom)
      continue

    dropPaneId.value = pane.id
    const y = e.clientY - rect.top

    if (y <= TAB_BAR_H) {
      dropZone.value = 'tabbar'
    }
    else {
      const contentY = y - TAB_BAR_H
      const contentH = rect.height - TAB_BAR_H
      dropZone.value = contentY < contentH / 2 ? 'top' : 'bottom'
    }
    return
  }

  dropPaneId.value = null
  dropZone.value = null
}

function onAsideDragLeave(e: DragEvent) {
  const related = e.relatedTarget as HTMLElement | null
  const aside = e.currentTarget as HTMLElement
  if (!related || !aside.contains(related)) {
    dropPaneId.value = null
    dropZone.value = null
  }
}

function onAsideDrop(e: DragEvent) {
  e.preventDefault()
  const tab = dragTab.value
  const sourceId = dragSourcePaneId.value
  const zone = dropZone.value
  const targetId = dropPaneId.value

  if (!tab || !sourceId || !zone || !targetId) {
    onTabDragEnd()
    return
  }

  if (zone === 'tabbar') {
    removeTabFromPane(sourceId, tab)
    const target = panes.value.find(p => p.id === targetId)
    if (target && !target.tabs.includes(tab)) {
      target.tabs.push(tab)
      target.activeTab = tab
    }
  }
  else {
    removeTabFromPane(sourceId, tab)
    const targetIdx = panes.value.findIndex(p => p.id === targetId)
    if (targetIdx !== -1) {
      const newPane: Pane = { id: uid(), tabs: [tab], activeTab: tab }
      const insertAt = zone === 'top' ? targetIdx : targetIdx + 1
      panes.value.splice(insertAt, 0, newPane)
      redistributeSizes()
    }
  }

  onTabDragEnd()
}

function removeTabFromPane(paneId: string, tab: TabId) {
  const idx = panes.value.findIndex(p => p.id === paneId)
  if (idx === -1)
    return

  const pane = panes.value[idx]
  const tabIdx = pane.tabs.indexOf(tab)
  if (tabIdx === -1)
    return

  pane.tabs.splice(tabIdx, 1)

  if (pane.tabs.length === 0) {
    panes.value.splice(idx, 1)
    paneSizes.value.splice(idx, 1)
    redistributeSizes()
  }
  else if (pane.activeTab === tab) {
    pane.activeTab = pane.tabs[0]
  }
}

function redistributeSizes() {
  const count = panes.value.length
  if (count === 0)
    return
  paneSizes.value = new Array(count).fill(100 / count)
}

// ─── Resize ──────────────────────────────────────────────────────────────────

const containerRef = ref<HTMLElement | null>(null)
let resizingIdx = -1
let resizeStartY = 0
let resizeStartSizes: number[] = []

function onResizerDown(idx: number, e: MouseEvent) {
  e.preventDefault()
  resizingIdx = idx
  resizeStartY = e.clientY
  resizeStartSizes = [...paneSizes.value]
  window.addEventListener('mousemove', onResizerMove)
  window.addEventListener('mouseup', onResizerUp)
}

function onResizerMove(e: MouseEvent) {
  if (resizingIdx === -1 || !containerRef.value)
    return
  const totalH = containerRef.value.clientHeight
  const deltaPct = ((e.clientY - resizeStartY) / totalH) * 100
  const next = [...resizeStartSizes]
  next[resizingIdx] = Math.max(15, next[resizingIdx] + deltaPct)
  next[resizingIdx + 1] = Math.max(15, next[resizingIdx + 1] - deltaPct)
  paneSizes.value = next
}

function onResizerUp() {
  resizingIdx = -1
  window.removeEventListener('mousemove', onResizerMove)
  window.removeEventListener('mouseup', onResizerUp)
}

onUnmounted(() => {
  window.removeEventListener('mousemove', onResizerMove)
  window.removeEventListener('mouseup', onResizerUp)
})
</script>

<template>
  <aside
    ref="containerRef"
    class="w-56 flex flex-col border-l border-default shrink-0 overflow-hidden"
    @dragover="onAsideDragOver"
    @dragenter.prevent
    @dragleave="onAsideDragLeave"
    @drop="onAsideDrop"
  >
    <template v-for="(pane, paneIdx) in panes" :key="pane.id">
      <!-- ── Pane ── -->
      <div
        :ref="(el) => setPaneEl(pane.id, el as HTMLElement | null)"
        class="flex flex-col min-h-0 relative"
        :style="{ flex: `${paneSizes[paneIdx]} 1 0%` }"
      >
        <!-- Tab bar -->
        <div
          class="flex items-stretch border-b border-default shrink-0 transition-colors"
          :class="dropPaneId === pane.id && dropZone === 'tabbar' ? 'bg-primary/10' : ''"
          :style="{ height: `${TAB_BAR_H}px` }"
        >
          <button
            v-for="tab in pane.tabs"
            :key="tab"
            draggable="true"
            :title="t(TAB_DEFS[tab].labelKey)"
            class="flex items-center gap-1.5 px-2.5 h-full text-xs transition-colors border-b-2 shrink-0 active:cursor-grabbing"
            :class="pane.activeTab === tab
              ? 'text-default border-primary'
              : 'text-muted border-transparent hover:text-default hover:border-default'"
            @click="pane.activeTab = tab"
            @dragstart="onTabDragStart(tab, pane.id, $event)"
            @dragend="onTabDragEnd"
          >
            <UIcon :name="TAB_DEFS[tab].icon" class="size-3.5 shrink-0" />
            <span v-if="pane.activeTab === tab" class="text-[11px] font-medium">
              {{ t(TAB_DEFS[tab].labelKey) }}
            </span>
          </button>
        </div>

        <!-- Content -->
        <div class="flex-1 overflow-y-auto min-h-0 relative">
          <EditorPanelTabContent
            :tab-id="pane.activeTab"
            :image-width="props.imageWidth"
            :image-height="props.imageHeight"
            :image-url="props.imageUrl"
          />

          <!-- Drop zone overlays -->
          <div
            v-if="dropPaneId === pane.id && dropZone === 'top'"
            class="absolute inset-x-0 top-0 h-1/2 pointer-events-none z-10 rounded"
            style="background: color-mix(in srgb, #3b82f6 12%, transparent); border: 2px dashed color-mix(in srgb, #3b82f6 50%, transparent);"
          />
          <div
            v-if="dropPaneId === pane.id && dropZone === 'bottom'"
            class="absolute inset-x-0 bottom-0 h-1/2 pointer-events-none z-10 rounded"
            style="background: color-mix(in srgb, #3b82f6 12%, transparent); border: 2px dashed color-mix(in srgb, #3b82f6 50%, transparent);"
          />
        </div>
      </div>

      <!-- ── Resize handle ── -->
      <div
        v-if="paneIdx < panes.length - 1"
        class="shrink-0 cursor-row-resize bg-default hover:bg-primary/40 transition-colors"
        style="height: 4px;"
        @mousedown="onResizerDown(paneIdx, $event)"
      />
    </template>
  </aside>
</template>
