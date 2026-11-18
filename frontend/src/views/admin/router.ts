import { RouteRecordRaw } from 'vue-router'

const Admin = () => import('./Admin.vue')

const routes: Array<RouteRecordRaw> = [
  {
    path: 'admin',
    name: 'Admin',
    component: Admin,
    meta: { requiresAdmin: true },
  },
]

export default routes
