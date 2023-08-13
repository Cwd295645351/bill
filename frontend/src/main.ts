import { createApp } from 'vue'
import router from '@/router'
import { createPinia } from 'pinia'

import './style.css'
import App from './App.vue'

import 'element-plus/dist/index.css'

const app = createApp(App)

app.use(router)
app.use(createPinia())

app.mount('#app')
