import { RouteRecordRaw } from 'vue-router'

const BillDetail = () => import('./BillDetail.vue')
const SearchRecord = () => import('./components/records/components/search-page/Index.vue')

const routes: Array<RouteRecordRaw> = [
  {
    path: '/bill-detail',
    name: 'BillDetail',
    component: BillDetail,
  },
  {
    path: '/bill-record-search',
    name: 'BillRecordSearch',
    component: SearchRecord,
  },
]

export default routes
