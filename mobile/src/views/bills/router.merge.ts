import { RouteRecordRaw } from 'vue-router'

const Bills = () => import('./Bills.vue')

const routes: Array<RouteRecordRaw> = [{ path: '/layout/bills', name: 'Bills', component: Bills }]

export default routes
