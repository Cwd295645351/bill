import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from '@/router'

import './style.css'
import App from './App.vue'

import 'element-plus/dist/index.css'

const app = createApp(App)

app.use(createPinia())
app.use(router)

app.mount('#app')