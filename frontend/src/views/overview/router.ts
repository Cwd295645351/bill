import { RouteRecordRaw } from 'vue-router'

const Overview = () => import('./Overview.vue')

const routes: Array<RouteRecordRaw> = [
  { path: 'bill/:billId/overview', name: 'Overview', component: Overview },
]

export default routes
