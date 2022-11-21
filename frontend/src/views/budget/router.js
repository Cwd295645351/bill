const Budget = () => import('./Index.vue')

export default [
  {
    path: '/layout/budget',
    name: 'Budget',
    component: Budget,
    meta: {
      parent: '/layout'
    }
  }
]
