import { createRouter, createWebHashHistory, RouteRecordRaw } from 'vue-router'

import loginRoute from '@/views/login/router'

const routes: Array<RouteRecordRaw> = [{ path: '/', redirect: '/login' }]
routes.push(...loginRoute)

const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

console.log(routes)

const NOT_CHECK_ROUTE = '/login'
router.beforeEach((route, next) => {
  if (!NOT_CHECK_ROUTE.includes(route.fullPath)) {
    try {
      // getUserInfo()
    } catch {
      router.push('/login')
    }
  }
})
export default router
