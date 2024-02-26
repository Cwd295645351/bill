import { RouteRecordRaw } from 'vue-router'

const BillDetail = () => import('./BillDetail.vue')

const routes: Array<RouteRecordRaw> = [{ path: '/layout/bill-detail/:billId', name: 'BillDetail', component: BillDetail }]

export default routes
