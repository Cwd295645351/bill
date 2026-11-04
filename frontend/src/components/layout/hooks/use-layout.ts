import { ref, watch, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useRoute } from 'vue-router'
import router from '@/router'
import { useBillStore } from '@/store'
import { getUserInfo, logoutUser } from '@/utils/common-info'
import { billTabPath, isBillTab, type BillTab } from '@/router/helpers'
import { joinBill, getBillInfo } from '../api'
import type { UserInfo } from '@/types/user-info'
import type { Menu } from '../type'

const NAME_TO_TAB: Record<string, string> = {
  Bill: 'bills',
  Record: 'record',
  Overview: 'overview',
  Budget: 'budget',
  Plan: 'plan',
  Asset: 'asset',
}

export const useLayout = () => {
  const store = useBillStore()
  const { billId } = storeToRefs(store)
  const route = useRoute()

  const $joinForm = ref()

  /** 加入账本弹窗 */
  const joinBillDialog = ref(false)
  /** 弹窗loadig */
  const dialogLoading = ref(false)
  /** 加入账本表单 */
  const form = ref({ name: '' })
  /** 当前菜单 */
  const currentMenu = ref('bills')
  /** 账本菜单 */
  const billsMenu: Menu[] = [{ label: '账本', value: 'bills', route: '/layout/bill' }]
  const menus = ref<Menu[]>(billsMenu)
  const avatarUrl = ref('')
  const userInfo = ref<UserInfo>({ accessToken: '', refreshToken: '', userId: '', expiresIn: 0, avatarUrl: '', nickName: '', expenses: 0, incomes: 0 })

  const buildRecordMenus = (id: string): Menu[] => [
    { label: '记账', value: 'record', route: billTabPath(id, 'record') },
    { label: '概览', value: 'overview', route: billTabPath(id, 'overview') },
    { label: '预算', value: 'budget', route: billTabPath(id, 'budget') },
    { label: '计划', value: 'plan', route: billTabPath(id, 'plan') },
    { label: '资产', value: 'asset', route: billTabPath(id, 'asset') },
  ]

  const syncMenusFromBillId = (id: string | null | undefined) => {
    if (id) {
      menus.value = buildRecordMenus(id)
    } else {
      menus.value = billsMenu
    }
  }

  const syncTabFromRoute = () => {
    const name = typeof route.name === 'string' ? route.name : ''
    const tab = NAME_TO_TAB[name]
    if (tab) {
      currentMenu.value = tab
      sessionStorage.setItem('tabValue', tab)
    }
  }

  /** 查询账本详情（须在 immediate watch 之前声明，避免 TDZ） */
  const getInfo = async (id: string) => {
    const params = { id }
    const [err, res] = await getBillInfo({ params })
    if (err) return
    store.updateState({ key: 'bill', value: res.data })
  }

  /** 路由中的账本 ID → store + sessionStorage */
  watch(
    () => route.params.billId as string | undefined,
    (val) => {
      if (val) {
        if (billId.value !== val) {
          store.updateState({ key: 'billId', value: val })
        }
        sessionStorage.setItem('billId', val)
        syncMenusFromBillId(val)
        getInfo(val)
      } else if (route.name === 'Bill') {
        syncMenusFromBillId(null)
      }
      syncTabFromRoute()
    },
    { immediate: true },
  )

  watch(billId, (val) => {
    syncMenusFromBillId(val || null)
    if (!route.params.billId) {
      currentMenu.value = sessionStorage.getItem('tabValue') || (val ? 'record' : 'bills')
    }
  })

  /** 初始化 */
  const init = () => {
    const routeBillId = route.params.billId as string | undefined
    const stored = sessionStorage.getItem('billId') || ''
    const id = routeBillId || stored
    userInfo.value = getUserInfo()
    if (id) {
      store.updateState({ key: 'billId', value: id })
      sessionStorage.setItem('billId', id)
      syncMenusFromBillId(id)
    } else {
      syncMenusFromBillId(null)
    }
    syncTabFromRoute()
    if (!currentMenu.value) {
      currentMenu.value = sessionStorage.getItem('tabValue') || (id ? 'record' : 'bills')
    }
    avatarUrl.value = `url(${userInfo.value.avatarUrl})`
  }

  /** 切换菜单 */
  const changeMenu = (tab: Menu) => {
    if (tab.value === currentMenu.value) return
    currentMenu.value = tab.value
    sessionStorage.setItem('tabValue', tab.value)
    const id = (billId.value as string) || sessionStorage.getItem('billId') || ''
    if (tab.value !== 'bills' && id && isBillTab(tab.value)) {
      router.push(billTabPath(id, tab.value as BillTab))
      return
    }
    router.push(tab.route)
  }

  /** 子模块跳转路由 */
  const changeTabValue = (value: string) => {
    currentMenu.value = value
    sessionStorage.setItem('tabValue', value)
  }

  /** 返回账本页 */
  const backToBills = () => {
    if (route.name === 'Bill' || route.path === '/layout/bill') return
    store.updateState({ key: 'billId', value: '' })
    sessionStorage.setItem('billId', '')
    sessionStorage.setItem('tabValue', 'bills')
    store.updateState({ key: 'bill', value: null })
    router.push('/layout/bill')
  }

  /** 退出登录 */
  const logout = () => {
    logoutUser()
  }


  const showJoinBillDialog = () => {
    joinBillDialog.value = true
    form.value.name = ''
  }

  // 加入账本
  const join = async () => {
    $joinForm.value.validate(async (valid: boolean) => {
      if (valid) {
        const data = { code: form.value.name }
        dialogLoading.value = true
        const [err, res] = await joinBill({ data })
        joinBillDialog.value = false
        dialogLoading.value = false
        if (err) return
        if (res.retCode === 0) {
          ElMessage.success('加入账本成功')
          store.updateState({ key: 'updateBill', value: true })
        } else {
          ElMessage.error('加入账本失败，' + res.message)
        }
      }
    })
  }

  onMounted(() => {
    init()
  })

  return { $joinForm, joinBillDialog, dialogLoading, form, currentMenu, menus, avatarUrl, userInfo, changeMenu, backToBills, logout, showJoinBillDialog, join, changeTabValue }
}

