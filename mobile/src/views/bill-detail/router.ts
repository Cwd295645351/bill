import { RouteRecordRaw } from 'vue-router'

const BillDetail = () => import('./BillDetail.vue')
const SearchRecord = () => import('./components/records/components/search-page/Index.vue')
const AddRecord = () => import('./components/records/components/add-page/Index.vue')
const EditRecord = () => import('./components/records/components/edit-page/Index.vue')

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
  {
    path: '/bill-record-add',
    name: 'BillRecordAdd',
    component: AddRecord,
  },
  {
    path: '/bill-record-edit',
    name: 'BillRecordEdit',
    component: EditRecord,
  },
]

export default routes
