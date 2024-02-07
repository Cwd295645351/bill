import { RouteRecordRaw } from 'vue-router'

const UserInfo = () => import('./UserInfo.vue')

const routes: Array<RouteRecordRaw> = [{ path: '/layout/user-info', name: 'UserInfo', component: UserInfo }]

export default routes
