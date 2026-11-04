import { ref, watch, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useRoute } from 'vue-router'
import router from '@/router'
import { useBillStore } from '@/store'
import { getUserInfo, logoutUser, patchUserInfo } from '@/utils/common-info'
import { billTabPath, isBillTab, type BillTab } from '@/router/helpers'
import { KEYUTIL, KJUR, hextob64 } from 'jsrsasign'
import { joinBill, getBillInfo, updateProfile, changePassword, getLoginConfig, uploadAvatar } from '../api'
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
  /** 修改个人信息弹窗 */
  const profileDialog = ref(false)
  /** 弹窗loadig */
  const dialogLoading = ref(false)
  /** 加入账本表单 */
  const form = ref({ name: '' })
  /** 个人资料表单（昵称/头像） */
  const profileForm = ref({ nickName: '' })
  /** 修改密码表单 */
  const passwordForm = ref({ oldPassword: '', newPassword: '', confirmPassword: '' })
  const profileTab = ref<'info' | 'password'>('info')
  const $avatarInput = ref<HTMLInputElement | null>(null)
  const avatarFile = ref<File | null>(null)
  const profileAvatarPreview = ref('')
  const loginPublicKey = ref('')
  /** 当前菜单 */
  const currentMenu = ref('bills')
  /** 账本菜单 */
  const billsMenu: Menu[] = [{ label: '账本', value: 'bills', route: '/layout/bill' }]
  const menus = ref<Menu[]>(billsMenu)
  /** 已上传头像的可访问 URL；空则显示默认 icon */
  const avatarSrc = ref('')
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
    avatarSrc.value = userInfo.value.avatarUrl || ''
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

  const encryptPassword = (password: string, publicKeyPem: string) => {
    const pub: any = KEYUTIL.getKey(publicKeyPem)
    const encryptData = KJUR.crypto.Cipher.encrypt(password, pub, 'RSA')
    return hextob64(encryptData)
  }

  const ensurePublicKey = async () => {
    if (loginPublicKey.value) return loginPublicKey.value
    const [err, res] = await getLoginConfig()
    if (err || !res || res.retCode !== 0 || !res.data?.publicKey) {
      ElMessage.error((res && res.message) || '获取加密配置失败')
      return ''
    }
    loginPublicKey.value = res.data.publicKey
    return loginPublicKey.value
  }

  const showProfileDialog = () => {
    profileTab.value = 'info'
    profileForm.value = { nickName: userInfo.value.nickName || '' }
    passwordForm.value = { oldPassword: '', newPassword: '', confirmPassword: '' }
    avatarFile.value = null
    profileAvatarPreview.value = userInfo.value.avatarUrl || ''
    profileDialog.value = true
  }

  const onProfileDialogClosed = () => {
    if (profileAvatarPreview.value && profileAvatarPreview.value.startsWith('blob:')) {
      try { URL.revokeObjectURL(profileAvatarPreview.value) } catch (_) {}
    }
    avatarFile.value = null
    profileAvatarPreview.value = userInfo.value.avatarUrl || ''
  }

  const triggerAvatarPick = () => {
    $avatarInput.value?.click()
  }

  const onAvatarPicked = (e: Event) => {
    const input = e.target as HTMLInputElement
    const file = input.files && input.files[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) {
      ElMessage.error('单张照片不能超过 10MB')
      input.value = ''
      return
    }
    if (profileAvatarPreview.value && profileAvatarPreview.value.startsWith('blob:')) {
      try { URL.revokeObjectURL(profileAvatarPreview.value) } catch (_) {}
    }
    avatarFile.value = file
    profileAvatarPreview.value = URL.createObjectURL(file)
  }

  const applyUserPatch = (data: Record<string, any>, nickFallback?: string) => {
    userInfo.value = patchUserInfo({
      nickName: data.nickName || nickFallback || userInfo.value.nickName,
      avatarUrl: data.avatarUrl != null ? data.avatarUrl : userInfo.value.avatarUrl,
      incomes: data.incomes != null ? Number(data.incomes) : userInfo.value.incomes,
      expenses: data.expenses != null ? Number(data.expenses) : userInfo.value.expenses,
    })
    avatarSrc.value = userInfo.value.avatarUrl || ''
  }

  const saveProfileInfo = async () => {
    const nick = (profileForm.value.nickName || '').trim()
    const nickReg = /^[\u4E00-\u9FA5A-Za-z0-9_]{1,20}$/
    if (!nickReg.test(nick)) {
      ElMessage.error('昵称须为 1～20 位中文、英文、数字或下划线')
      return
    }
    const nickChanged = nick !== (userInfo.value.nickName || '')
    if (!avatarFile.value && !nickChanged) {
      ElMessage.info('没有需要保存的变更')
      return
    }

    dialogLoading.value = true
    try {
      if (avatarFile.value) {
        const [errUp, resUp] = await uploadAvatar({ data: { file: avatarFile.value } })
        if (errUp) return
        if (resUp.retCode !== 0) {
          ElMessage.error(resUp.message || '头像上传失败')
          return
        }
        applyUserPatch(resUp.data || {})
        avatarFile.value = null
        profileAvatarPreview.value = userInfo.value.avatarUrl || profileAvatarPreview.value
      }

      if (nickChanged) {
        const [err, res] = await updateProfile({ data: { nickName: nick } })
        if (err) return
        if (res.retCode !== 0) {
          ElMessage.error(res.message || '昵称更新失败')
          return
        }
        applyUserPatch(res.data || {}, nick)
      }

      ElMessage.success('个人资料已更新')
    } finally {
      dialogLoading.value = false
    }
  }

  const savePassword = async () => {
    const oldPwd = (passwordForm.value.oldPassword || '').trim()
    const newPwd = (passwordForm.value.newPassword || '').trim()
    const confirmPwd = (passwordForm.value.confirmPassword || '').trim()
    if (!oldPwd || !newPwd) {
      ElMessage.error('请填写旧密码和新密码')
      return
    }
    if (newPwd !== confirmPwd) {
      ElMessage.error('两次输入的新密码不一致')
      return
    }
    if (newPwd.length < 8 || !/[a-z]/.test(newPwd) || !/[A-Z]/.test(newPwd) || !/\d/.test(newPwd)) {
      ElMessage.error('新密码至少 8 位，且须包含大小写字母与数字')
      return
    }

    dialogLoading.value = true
    try {
      const pub = await ensurePublicKey()
      if (!pub) return
      const [errPwd, resPwd] = await changePassword({
        data: {
          oldPassword: encryptPassword(oldPwd, pub),
          newPassword: encryptPassword(newPwd, pub),
        },
      })
      if (errPwd) return
      if (resPwd.retCode !== 0) {
        ElMessage.error(resPwd.message || '修改密码失败')
        return
      }
      profileDialog.value = false
      ElMessage.success('密码已更新，请重新登录')
      logoutUser()
    } finally {
      dialogLoading.value = false
    }
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

  return { $joinForm, $avatarInput, joinBillDialog, profileDialog, profileTab, dialogLoading, form, profileForm, passwordForm, profileAvatarPreview, avatarSrc, currentMenu, menus, userInfo, changeMenu, backToBills, logout, showJoinBillDialog, showProfileDialog, saveProfileInfo, savePassword, triggerAvatarPick, onAvatarPicked, onProfileDialogClosed, join, changeTabValue }
}

