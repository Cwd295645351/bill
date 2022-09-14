const Layout = () => import('./Index.vue')
const Record = () => import('../record/Index.vue')

export default [
  {
    path: '/layout',
    name: 'Layout',
    component: Layout
  }
]
