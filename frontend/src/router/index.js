import Vue from 'vue'
import VueRouter from 'vue-router'

Vue.use(VueRouter)

const routes = []

// 读取 views 页面中定义的路由
const viewsRouteDoc = require.context('../views', true, /router.js$/)
const viewsRoutes = viewsRouteDoc
  .keys()
  .map((module) => viewsRouteDoc(module).default)
  .flat()

routes.push(...viewsRoutes)

const router = new VueRouter({ routes })

export default router
