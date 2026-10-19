import { RouteRecordRaw } from 'vue-router'

const Asset = () => import('./Asset.vue')

const routes: Array<RouteRecordRaw> = [{ path: '/layout/asset', name: 'Asset', component: Asset }]

export default routes
