import { createRouter, createWebHistory, type RouteRecordRaw, type RouteLocationNormalized } from 'vue-router'
import { getUserInfo } from '@/utils/common-info'
import { isAuthenticated, sanitizeRedirect } from './helpers'

import loginRoute from '@/components/login/router'
import layoutRoute from '@/components/layout/router'

const routes: Array<RouteRecordRaw> = [{ path: '/', redirect: '/login' }]

// 读取 views 页面中定义的路由
const routeModules: any = import.meta.glob('../views/**/router.ts', { eager: true })
const childRoutes = Object.keys(routeModules)
  .map((path: string) => routeModules[path].default)
  .flat()
layoutRoute[0].children?.push(...childRoutes)

routes.push(...loginRoute)
routes.push(...layoutRoute)

routes.push({
  path: '/:pathMatch(.*)*',
  name: 'NotFound',
  component: () => import('@/views/not-found/NotFound.vue'),
  meta: { public: false },
})

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

router.beforeEach((to: RouteLocationNormalized) => {
  if (to.meta?.public) return true

  const userInfo = getUserInfo()
  if (!isAuthenticated(userInfo)) {
    const redirect = sanitizeRedirect(to.fullPath)
    return {
      path: '/login',
      query: redirect ? { redirect } : {},
    }
  }

  // 运营后台：在进入页面前拦截，避免非管理员先闪一下再跳走
  if (to.matched.some((record) => record.meta?.requiresAdmin === true) && userInfo?.isAdmin !== true) {
    ElMessage.warning('非管理员没有权限')
    return { path: '/layout/bill' }
  }

  return true
})

export default router