import { RouteRecordRaw } from 'vue-router'

const Budget = () => import('./Budget.vue')

const routes: Array<RouteRecordRaw> = [{ path: '/layout/budget', name: 'Budget', component: Budget }]

export default routes
