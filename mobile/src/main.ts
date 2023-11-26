import { createApp } from 'vue'
import router from '@/router'

import './style.css'
import 'vant/es/toast/style';
import App from './App.vue'

const app = createApp(App)
app.use(router)

app.mount('#app')
