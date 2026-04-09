import ui from '@nuxt/ui/vue-plugin'
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import App from './App.vue'
import './assets/css/main.css'

const app = createApp(App)

app.use(ui)
app.use(createPinia())
app.use(router)

app.mount('#app')
