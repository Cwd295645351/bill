import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { useAssetViewStore } from '@/stores/asset-view'
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
    path: '/bill/:id/budget',
    name: 'bill-budget',
    component: () => import('@/views/budget/BudgetView.vue'),
  },
  {
    path: '/bill/:id/plan',
    name: 'bill-plan',
    component: () => import('@/views/plan/PlanView.vue'),
  },
  {
    path: '/bill/:id/overview',
    name: 'bill-overview',
    component: () => import('@/views/overview/OverviewView.vue'),
  },
  {
    path: '/bill/:id/asset',
    name: 'bill-asset',
    component: () => import('@/views/asset/OverviewView.vue'),
  },
  {
    path: '/bill/:id/asset/four',
    name: 'bill-asset-four',
    component: () => import('@/views/asset/FourView.vue'),
  },
  {
    path: '/bill/:id/asset/month',
    name: 'bill-asset-month',
    component: () => import('@/views/asset/MonthView.vue'),
  },
  {
    path: '/bill/:id/asset/trend',
    name: 'bill-asset-trend',
    component: () => import('@/views/asset/TrendView.vue'),
  },
  {
    path: '/bill/:id/asset/retire',
    name: 'bill-asset-retire',
    component: () => import('@/views/asset/RetireView.vue'),
  },
  {
    path: '/bill/:id/asset/form',
    name: 'bill-asset-form',
    component: () => import('@/views/asset/FormView.vue'),
  },
  {
    path: '/bill/:id/asset/records',
    name: 'bill-asset-records',
    component: () => import('@/views/asset/RecordsView.vue'),
  },
  {
    path: '/bill/:id/asset/members',
    name: 'bill-asset-members',
    component: () => import('@/views/asset/MembersView.vue'),
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

router.afterEach((to, from) => {
  const wasAsset = String(from.path || '').includes('/asset')
  const nowAsset = String(to.path || '').includes('/asset')
  if (wasAsset && !nowAsset) useAssetViewStore().reset()
})

export default router
