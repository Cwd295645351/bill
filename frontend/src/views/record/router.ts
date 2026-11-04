import { RouteRecordRaw } from 'vue-router'

const Record = () => import('./Record.vue')

const routes: Array<RouteRecordRaw> = [
  { path: 'bill/:billId/record', name: 'Record', component: Record },
]

export default routes
