import Vue from 'vue'
import VueRouter from 'vue-router'

Vue.use(VueRouter)

const routes = [{ path: '/', redirect: '/login' }]

// 读取 views 页面中定义的路由
const viewsRouteDoc = require.context('../views', true, /router.js$/)
const viewsRoutes = viewsRouteDoc
  .keys()
  .map((module) => viewsRouteDoc(module).default)
  .flat()

const childRoutes = viewsRoutes.filter((route) => route.meta?.parent) // 子路由
const rootRoutes = viewsRoutes.filter((route) => !route.meta?.parent) // 根路由

routes.push(...rootRoutes)

childRoutes.forEach((route) => {
  const rootRoute = routes.find((item) => item.path === route.meta.parent)
  if (rootRoute) {
    if (!rootRoute.children) rootRoute.children = []
    rootRoute.children.push(route)
  } else {
    routes.push(route)
  }
})

const router = new VueRouter({ routes })

export default router
