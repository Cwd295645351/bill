import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { useSessionStore } from '@/stores/session'

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/login/LoginView.vue'),
    meta: { public: true },
  },
  {
    path: '/join',
    name: 'join',
    component: () => import('@/views/join/JoinView.vue'),
    meta: { public: false },
  },
  {
    path: '/',
    component: () => import('@/layouts/MainTabLayout.vue'),
    redirect: '/bills',
    children: [
      {
        path: 'bills',
        name: 'bills',
        component: () => import('@/views/bills/BillsView.vue'),
      },
      {
        path: 'record-add',
        name: 'record-add',
        component: () => import('@/views/record-add/RecordAddView.vue'),
      },
      {
        path: 'mine',
        name: 'mine',
        component: () => import('@/views/mine/MineView.vue'),
      },
    ],
  },
  {
    path: '/bill/:id',
    name: 'bill-detail',
    component: () => import('@/views/bill-detail/BillDetailView.vue'),
  },
  {
    path: '/record/create',
    name: 'record-create',
    component: () => import('@/views/record-create/RecordCreateView.vue'),
  },
  {
    path: '/record/edit',
    name: 'record-edit',
    component: () => import('@/views/record-edit/RecordEditView.vue'),
  },
  {
    path: '/record/search',
    name: 'record-search',
    component: () => import('@/views/record-search/RecordSearchView.vue'),
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/bills',
  },
]

const router = createRouter({
  history: createWebHistory('/mobile/'),
  routes,
})

router.beforeEach((to) => {
  const session = useSessionStore()
  const authed = session.isAuthenticated

  if (to.name === 'login') {
    if (authed) {
      const redirect = typeof to.query.redirect === 'string' ? to.query.redirect : ''
      if (redirect && redirect.startsWith('/') && !redirect.startsWith('//')) {
        return redirect
      }
      return { name: 'bills' }
    }
    return true
  }

  if (!to.meta.public && !authed) {
    return {
      name: 'login',
      query: { redirect: to.fullPath },
    }
  }

  return true
})

export default router
