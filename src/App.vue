<script setup lang="ts">
import * as locales from '@nuxt/ui/locale'
import { useI18n } from 'vue-i18n'

const { locale } = useI18n()

function selectedLocale() {
  const loc = locales[locale.value as keyof typeof locales]
  return loc || locales.en
}
</script>

<template>
  <UApp :locale="selectedLocale()">
    <RouterView />
  </UApp>
</template>
