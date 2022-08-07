import Vue from 'vue'
import router from './router'
import store from './store'
import App from './App.vue'

import { log } from '@/utils/log'

Vue.prototype.$log = log

const vue = new Vue({ router, store, render: (h) => h(App) }).$mount('#app')

export default vue
