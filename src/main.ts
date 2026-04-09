import ui from '@nuxt/ui/vue-plugin'
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import App from './App.vue'
import './assets/css/main.css'
import { createI18n } from 'vue-i18n'
import en from './locales/en.json'
import tr from './locales/tr.json'

const app = createApp(App)

const i18n = createI18n({
    locale: 'en',
    fallbackLocale: 'en',
    messages: { en, tr },
})

app.use(ui)
app.use(createPinia())
app.use(router)
app.use(i18n)

app.mount('#app')
