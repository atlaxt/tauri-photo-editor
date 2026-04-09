<script setup lang="ts">
import * as locales from '@nuxt/ui/locale'
import { useI18n } from 'vue-i18n'

const { locale } = useI18n()
</script>

<template>
  <UApp :locale="locales[locale]">
    <RouterView />
  </UApp>
</template>
