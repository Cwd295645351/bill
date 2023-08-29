import { RouteRecordRaw } from 'vue-router'

const Plan = () => import('./Plan.vue')

const routes: Array<RouteRecordRaw> = [{ path: '/layout/plan', name: 'Plan', component: Plan }]

export default routes
