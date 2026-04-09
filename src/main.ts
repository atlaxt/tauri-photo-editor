import ui from '@nuxt/ui/vue-plugin'
import { createPinia } from 'pinia'
import { createApp } from 'vue'
import { createI18n } from 'vue-i18n'
import App from './App.vue'
import en from './locales/en.json'
import tr from './locales/tr.json'
import router from './router'
import './assets/css/main.css'

const app = createApp(App)

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  fallbackLocale: 'en',
  availableLocales: ['en', 'tr'],
  messages: { en, tr },
})

app.use(ui)
app.use(createPinia())
app.use(router)
app.use(i18n)

app.mount('#app')
