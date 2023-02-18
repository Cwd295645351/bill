import Vue from 'vue'
import VueRouter from 'vue-router'
import layoutRoute from '@/components/layout/router.js'
import loginRoute from '@/components/login/router.js'

Vue.use(VueRouter)

const routes = [{ path: '/', redirect: '/login' }]

// 读取 views 页面中定义的路由
const viewsRouteDoc = require.context('../views', true, /router.js$/)
const viewsRoutes = viewsRouteDoc
  .keys()
  .map((module) => viewsRouteDoc(module).default)
  .flat()

layoutRoute[0].children.push(...viewsRoutes)

routes.push(...loginRoute)
routes.push(...layoutRoute)

const router = new VueRouter({ routes })

export default router
