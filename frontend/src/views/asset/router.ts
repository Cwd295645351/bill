import { RouteRecordRaw } from 'vue-router'

const Asset = () => import('./Asset.vue')

const routes: Array<RouteRecordRaw> = [
  { path: 'bill/:billId/asset', name: 'Asset', component: Asset },
]

export default routes
