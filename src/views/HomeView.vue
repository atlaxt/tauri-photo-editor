<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useEditorStore } from '../stores/editor'

const { t } = useI18n()
const router = useRouter()
const editorStore = useEditorStore()
const isTauriRuntime = '__TAURI_INTERNALS__' in window

// Taslak projeler — store'dan gelecek, şimdilik boş
const drafts: { id: string, name: string, path: string, updatedAt: string }[] = []

const isDragging = ref(false)
let unlistenDragDrop: (() => void) | null = null

onMounted(async () => {
  try {
    const { getCurrentWebviewWindow } = await import('@tauri-apps/api/webviewWindow')
    const win = getCurrentWebviewWindow()
    unlistenDragDrop = await win.onDragDropEvent((e) => {
      if (e.payload.type === 'enter') {
        isDragging.value = true
      }
      else if (e.payload.type === 'leave') {
        isDragging.value = false
      }
      else if (e.payload.type === 'drop') {
        isDragging.value = false
        const paths: string[] = (e.payload as any).paths ?? []
        const imagePath = paths.find(p => /\.(jpe?g|png|webp|gif|bmp|tiff?)$/i.test(p))
        if (imagePath) {
          editorStore.openFile(imagePath)
          router.push('/editor')
        }
      }
    })
  }
  catch {
    // Tarayıcıda DOM fallback
  }
})

onUnmounted(() => {
  unlistenDragDrop?.()
})

// Tarayıcı için DOM fallback
let dragCounter = 0

function onDragEnter(e: DragEvent) {
  e.preventDefault()
  dragCounter++
  if (dragCounter === 1)
    isDragging.value = true
}

function onDragLeave() {
  dragCounter--
  if (dragCounter === 0)
    isDragging.value = false
}

function onDragOver(e: DragEvent) {
  e.preventDefault()
}

function onDrop(e: DragEvent) {
  e.preventDefault()
  dragCounter = 0
  isDragging.value = false

  if (isTauriRuntime)
    return

  const files = e.dataTransfer?.files
  if (!files || files.length === 0)
    return

  const imageFile = Array.from(files).find(file => file.type.startsWith('image/'))
  if (!imageFile)
    return

  const blobUrl = URL.createObjectURL(imageFile)
  editorStore.openFile(blobUrl, imageFile.name)
  router.push('/editor')
}

async function openFile() {
  try {
    const { open } = await import('@tauri-apps/plugin-dialog')
    const selected = await open({
      multiple: false,
      filters: [{ name: t('home.imageFilterLabel'), extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'tiff'] }],
    })
    if (typeof selected === 'string') {
      editorStore.openFile(selected)
      router.push('/editor')
    }
  }
  catch {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = () => {
      const file = input.files?.[0]
      if (!file)
        return

      const blobUrl = URL.createObjectURL(file)
      editorStore.openFile(blobUrl, file.name)
      router.push('/editor')
    }
    input.click()
  }
}

function newFile() {
  router.push('/editor')
}

function usePreset() {
  router.push('/presets')
}
</script>

<template>
  <div
    class="flex flex-col h-screen bg-background relative"
    @dragenter="onDragEnter"
    @dragleave="onDragLeave"
    @dragover="onDragOver"
    @drop="onDrop"
  >
    <!-- Sürükle overlay -->
    <Transition
      enter-active-class="transition-opacity duration-200"
      leave-active-class="transition-opacity duration-200"
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
    >
      <div
        v-if="isDragging"
        class="absolute inset-0 z-50 flex items-center justify-center pointer-events-none"
      >
        <!-- Drop zone kutusu -->
        <div class="flex flex-col items-center gap-4 rounded-2xl px-20 py-14">
          <UIcon name="i-ph-image" class="size-9 text-primary/70" />
          <div class="text-center">
            <p class="text-sm font-medium">
              {{ $t('home.dropZone.title') }}
            </p>
            <p class="text-xs text-muted mt-0.5">
              {{ $t('home.dropZone.subtitle') }}
            </p>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Başlık çubuğu -->
    <header
      class="flex items-center justify-between px-6 py-4 transition-[filter] duration-200"
      :class="{ 'blur-sm': isDragging }"
    >
      <span class="text-sm font-medium text-muted">{{ $t('appName') }}</span>
      <UColorModeButton variant="ghost" color="neutral" size="sm" />
    </header>

    <!-- Ana içerik -->
    <main
      class="flex-1 flex flex-col items-center justify-center px-8 pb-16 gap-12 transition-[filter] duration-200"
      :class="{ 'blur-sm': isDragging }"
    >
      <!-- Karşılama -->
      <div class="text-center space-y-1">
        <h1 class="text-2xl font-semibold tracking-tight">
          {{ $t('home.welcome') }}
        </h1>
        <p class="text-sm text-muted">
          {{ $t('home.subtitle') }}
        </p>
      </div>

      <!-- Eylem kartları -->
      <div class="grid grid-cols-3 gap-4 w-full max-w-xl">
        <button
          class="group flex flex-col items-center gap-3 rounded-2xl border border-default bg-elevated p-6 text-center transition-all duration-150 hover:border-primary/40 hover:bg-primary/5 hover:shadow-sm active:scale-[0.98]"
          @click="newFile"
        >
          <UIcon name="i-ph-plus-circle" class="size-7 text-muted group-hover:text-primary transition-colors" />
          <div>
            <p class="text-sm font-medium">
              {{ $t('home.actions.newFile') }}
            </p>
            <p class="text-xs text-muted mt-0.5">
              {{ $t('home.actions.newFileDesc') }}
            </p>
          </div>
        </button>

        <button
          class="group flex flex-col items-center gap-3 rounded-2xl border border-default bg-elevated p-6 text-center transition-all duration-150 hover:border-primary/40 hover:bg-primary/5 hover:shadow-sm active:scale-[0.98]"
          @click="openFile"
        >
          <UIcon name="i-ph-image" class="size-7 text-muted group-hover:text-primary transition-colors" />
          <div>
            <p class="text-sm font-medium">
              {{ $t('home.actions.openFile') }}
            </p>
            <p class="text-xs text-muted mt-0.5">
              {{ $t('home.actions.openFileDesc') }}
            </p>
          </div>
        </button>

        <button
          class="group flex flex-col items-center gap-3 rounded-2xl border border-default bg-elevated p-6 text-center transition-all duration-150 hover:border-primary/40 hover:bg-primary/5 hover:shadow-sm active:scale-[0.98]"
          @click="usePreset"
        >
          <UIcon name="i-ph-stack" class="size-7 text-muted group-hover:text-primary transition-colors" />
          <div>
            <p class="text-sm font-medium">
              {{ $t('home.actions.usePreset') }}
            </p>
            <p class="text-xs text-muted mt-0.5">
              {{ $t('home.actions.usePresetDesc') }}
            </p>
          </div>
        </button>
      </div>

      <!-- Taslak projeler -->
      <section class="w-full max-w-xl">
        <p class="text-xs font-medium text-muted uppercase tracking-wider mb-3">
          {{ $t('home.drafts.title') }}
        </p>

        <div v-if="drafts.length === 0" class="flex flex-col items-center gap-2 py-10 text-muted">
          <UIcon name="i-ph-tray" class="size-8 opacity-40" />
          <p class="text-sm opacity-60">
            {{ $t('home.drafts.empty') }}
          </p>
        </div>

        <ul v-else class="space-y-1">
          <li
            v-for="draft in drafts"
            :key="draft.id"
            class="group flex items-center justify-between rounded-xl px-4 py-3 hover:bg-elevated transition-colors cursor-pointer"
            @click="router.push('/editor')"
          >
            <div class="flex items-center gap-3 min-w-0">
              <UIcon name="i-ph-file-image" class="size-4 text-muted shrink-0" />
              <div class="min-w-0">
                <p class="text-sm font-medium truncate">
                  {{ draft.name }}
                </p>
                <p class="text-xs text-muted truncate">
                  {{ draft.path }}
                </p>
              </div>
            </div>
            <span class="text-xs text-muted shrink-0 ml-4">{{ draft.updatedAt }}</span>
          </li>
        </ul>
      </section>
    </main>
  </div>
</template>
