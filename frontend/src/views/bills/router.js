const Bills = () => import('./Index.vue')

export default [
  {
    path: '/layout/bills',
    name: 'Bills',
    component: Bills,
    meta: {
      parent: '/layout'
    }
  }
]
