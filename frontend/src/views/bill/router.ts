import { RouteRecordRaw } from 'vue-router'

const Bill = () => import('./Bill.vue')

const routes: Array<RouteRecordRaw> = [{ path: '/layout/bill', name: 'Bill', component: Bill }]

export default routes
