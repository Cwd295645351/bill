import Vue from 'vue'
import router from './router'
import store from './store'
import App from './App.vue'

import ElementUI from 'element-ui'
import * as echarts from 'echarts'

import { log } from '@/utils/log'
import * as tools from '@/utils/tools'

import 'element-ui/lib/theme-chalk/index.css'
import '@/styles/reset.scss'

Vue.use(ElementUI)

Vue.prototype.$log = log
Vue.prototype.$echarts = echarts
Vue.prototype.$tools = tools

const vue = new Vue({ router, store, render: (h) => h(App) }).$mount('#app')

export default vue
