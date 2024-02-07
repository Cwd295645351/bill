import { createRouter, createWebHashHistory, RouteRecordRaw } from 'vue-router'
import { logoutUser, getUserInfo } from '@/utils/common-info'

import loginRoute from '@/views/login/router'
import layoutRoute from '@/views/layout/router'

// 动态读取 views 子路由
const childRouteModules: any = import.meta.glob('@/views/**/router.merge.ts', { eager: true })
const childRoutes = Object.keys(childRouteModules)
  .map((path: string) => childRouteModules[path].default)
  .flat()

console.log('childRoutes', childRoutes)
layoutRoute[0].children!.push(...childRoutes)

const routes: Array<RouteRecordRaw> = [{ path: '/', redirect: '/login' }]
routes.push(...loginRoute)
routes.push(...layoutRoute)

const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

console.log(routes)

const NOT_CHECK_ROUTE = '/login'
router.beforeEach((route, next) => {
  if (!NOT_CHECK_ROUTE.includes(route.fullPath)) {
    try {
      getUserInfo()
    } catch {
      sessionStorage.clear()
      router.push('/login')
    }
  } else {
    sessionStorage.clear()
  }
})
export default router
