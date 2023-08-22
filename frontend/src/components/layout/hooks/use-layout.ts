import { ref, watch, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import router from '@/router'
import { useBillStore } from '@/store'
import { getUserInfo, logoutUser } from '@/utils/common-info'
import { joinBill, getBillInfo } from '../api'
import type { UserInfo } from '@/types/user-info'
import type { Menu } from '../type'

export const useLayout = () => {
  const store = useBillStore()
  const { billId } = storeToRefs(store)

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
  const recordMenu: Menu[] = [
    { label: '记账', value: 'record', route: '/layout/record' },
    { label: '概览', value: 'overview', route: '/layout/overview' },
    // { label: '计划', value: 'plan', route: '/layout/record' },
    { label: '预算', value: 'budget', route: '/layout/budget' },
    // { label: '设置', value: 'setting', route: '/layout/record' }
  ]
  const menus = ref<Menu[]>(billsMenu)
  const avatarUrl = ref('')
  const userInfo = ref<UserInfo>({ accessToken: '', refreshToken: '', userId: '', expiresIn: 0, avatarUrl: '', nickName: '', expenses: 0, incomes: 0 })

  watch(billId, async (val) => {
    menus.value = val ? recordMenu : billsMenu
    currentMenu.value = sessionStorage.getItem('tabValue') as string

    if (val) {
      await getInfo(val)
    }
  })

  /** 初始化 */
  const init = () => {
    const billId = sessionStorage.getItem('billId')
    currentMenu.value = sessionStorage.getItem('tabValue') || 'bills'
    userInfo.value = getUserInfo()
    if (billId) {
      store.updateState({ key: 'billId', value: billId })
    }
    avatarUrl.value = `url(${userInfo.value.avatarUrl})`
  }

  /** 切换菜单 */
  const changeMenu = (tab: Menu) => {
    if (tab.value === currentMenu.value) return
    currentMenu.value = tab.value
    sessionStorage.setItem('tabValue', tab.value)
    router.push(tab.route)
  }

  /** 子模块跳转路由 */
  const changeTabValue = (value: string) => {
    currentMenu.value = value
    sessionStorage.setItem('tabValue', value)
  }

  /** 返回账本页 */
  const backToBills = () => {
    if (router.currentRoute.value.path === '/layout/bill') return
    store.updateState({ key: 'billId', value: '' })
    sessionStorage.setItem('billId', '')
    sessionStorage.setItem('tabValue', 'bills')
    router.push('/layout/bill')
  }

  /** 退出登录 */
  const logout = () => {
    logoutUser()
  }

  /** 查询账本详情 */
  const getInfo = async (billId: string) => {
    const params = { id: billId }
    const [err, res] = await getBillInfo({ params })
    if (err) return
    store.updateState({ key: 'bill', value: res.data })
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
