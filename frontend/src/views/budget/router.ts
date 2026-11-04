import { RouteRecordRaw } from 'vue-router'

const Budget = () => import('./Budget.vue')

const routes: Array<RouteRecordRaw> = [
  { path: 'bill/:billId/budget', name: 'Budget', component: Budget },
]

export default routes
