import { RouteRecordRaw } from 'vue-router'

const Layout = () => import('./Layout.vue')

const routes: Array<RouteRecordRaw> = [
  {
    path: '/layout',
    component: Layout,
    children: [{ path: '', name: 'LayoutRoot', redirect: '/layout/bill' }],
  },
]

export default routes
