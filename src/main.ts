import ui from '@nuxt/ui/vue-plugin'
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import './assets/css/main.css'

const app = createApp(App)
const pinia = createPinia()

app.use(ui)
app.use(pinia)

app.mount('#app')
