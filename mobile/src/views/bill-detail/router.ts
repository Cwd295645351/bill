import { RouteRecordRaw } from 'vue-router'

const BillDetail = () => import('./BillDetail.vue')

const routes: Array<RouteRecordRaw> = [{ path: '/bill-detail', name: 'BillDetail', component: BillDetail }]

export default routes
