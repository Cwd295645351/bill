import { RouteRecordRaw } from 'vue-router'

const Login = () => import('./Login.vue')

const routes: Array<RouteRecordRaw> = [{ path: '/login', name: 'Login', component: Login }]

export default routes
