import { ref, onMounted, watch } from 'vue'
import { storeToRefs } from 'pinia'
import router from '@/router'
import { useBillStore } from '@/store'
import { getUserInfo } from '@/utils/common-info'
import { billTabPath } from '@/router/helpers'
import { createBill, getBillList, deleteBill, shareBill, getBillDetail, quitBill } from '../api'
import type { UserInfo } from '@/types/user-info'
import type { Bill } from '../type'

export const useBill = () => {
  const store = useBillStore()
  const { updateBill } = storeToRefs(store)

  const $addForm = ref()

  const addBillDialog = ref(false)
  const deleteBillDialog = ref(false)
  const shareBillDialog = ref(false)
  const quitBillDialog = ref(false)
  const membersDialog = ref(false)
  const members = ref<{ id: string; name: string }[]>([])
  const membersLoading = ref(false)
  const dialogLoading = ref(false)
  const bills = ref<Bill[]>([])
  const form = ref({ name: '' })
  const currentOperateBill = ref<Bill>({ id: '', name: '', creator: '' })
  const shareCode = ref('')
  const typeManagerVisible = ref(false)
  const currentTypeBill = ref('')
  const userInfo = ref<UserInfo>({ accessToken: '', refreshToken: '', userId: '', expiresIn: 0, avatarUrl: '', nickName: '', expenses: 0, incomes: 0 })

  watch(updateBill, () => {
    getList()
    store.updateState({ key: 'updateBill', value: false })
  })

  const init = () => {
    userInfo.value = getUserInfo()
    getList()
  }

  const getList = async () => {
    const [err, res] = await getBillList()
    if (err) return
    if (res.retCode === 0) {
      bills.value = res.data
    } else {
      ElMessage.error('获取账本列表失败，' + res.message)
    }
  }

  const showBillDetail = async (item: Bill) => {
    sessionStorage.setItem('billId', item.id)
    sessionStorage.setItem('tabValue', 'record')
    store.updateState({ key: 'billId', value: item.id })
    router.push(billTabPath(item.id, 'record'))
  }

  const showBillDialog = () => {
    form.value.name = ''
    addBillDialog.value = true
  }

  const showTypeManager = (item: Bill) => {
    currentTypeBill.value = item.id
    typeManagerVisible.value = true
  }

  const showDeleteDialog = (item: Bill) => {
    deleteBillDialog.value = true
    currentOperateBill.value = item
  }

  const showQuitDialog = (item: Bill) => {
    currentOperateBill.value = item
    quitBillDialog.value = true
  }

  const doQuitBill = async () => {
    const data = { id: currentOperateBill.value.id, userId: userInfo.value.userId }
    dialogLoading.value = true
    const [err, res] = await quitBill({ data })
    dialogLoading.value = false
    quitBillDialog.value = false
    if (err) return
    if (res.retCode === 0) {
      ElMessage.success('已退出账本')
      if (sessionStorage.getItem('billId') === currentOperateBill.value.id) {
        sessionStorage.setItem('billId', '')
        store.updateState({ key: 'billId', value: '' })
        store.updateState({ key: 'bill', value: null })
      }
      getList()
    } else {
      ElMessage.error(res.message || '退出失败')
    }
  }

  const showMembersDialog = async (item: Bill) => {
    currentOperateBill.value = item
    membersDialog.value = true
    membersLoading.value = true
    members.value = []
    const [err, res] = await getBillDetail({ params: { id: item.id } })
    membersLoading.value = false
    if (err) return
    if (res.retCode === 0) {
      members.value = (res.data && res.data.users) || []
    } else {
      ElMessage.error(res.message || '获取成员失败')
    }
  }

  const removeMember = async (member: { id: string; name: string }) => {
    if (member.id === userInfo.value.userId) {
      ElMessage.error('不能移除自己')
      return
    }
    if (member.id === currentOperateBill.value.creator) {
      ElMessage.error('不能移除账本创建者')
      return
    }
    try {
      await ElMessageBox.confirm(`确定将「${member.name}」移出账本吗？`, '移除成员', { type: 'warning' })
    } catch {
      return
    }
    const data = { id: currentOperateBill.value.id, userId: member.id }
    dialogLoading.value = true
    const [err, res] = await quitBill({ data })
    dialogLoading.value = false
    if (err) return
    if (res.retCode === 0) {
      ElMessage.success('已移除成员')
      members.value = members.value.filter((m) => m.id !== member.id)
    } else {
      ElMessage.error(res.message || '移除失败')
    }
  }

  const addBill = async () => {
    $addForm.value.validate(async (valid: boolean) => {
      if (valid) {
        const data = { name: form.value.name }
        dialogLoading.value = true
        const [err, res] = await createBill({ data })
        dialogLoading.value = false
        if (err) return
        if (res.retCode === 0) {
          addBillDialog.value = false
          ElMessage.success('新增账本成功')
          getList()
        } else {
          ElMessage.error('新增账本失败，' + res.message)
        }
      }
    })
  }

  const delBill = async () => {
    const params = { id: currentOperateBill.value.id }
    dialogLoading.value = true
    const [err, res] = await deleteBill({ params })
    dialogLoading.value = false
    deleteBillDialog.value = false
    if (err) return
    if (res.retCode === 0) {
      ElMessage.success('删除账本成功')
      getList()
    } else {
      ElMessage.error('删除账本失败，' + res.message)
    }
  }

  const createShareBillCode = async (item: Bill) => {
    const data = { id: item.id }
    const [err, res] = await shareBill({ data })
    if (err) return
    if (res.retCode === 0) {
      shareCode.value = res.data
      shareBillDialog.value = true
    } else {
      ElMessage.error('生成分享码失败，' + res.message)
    }
  }

  onMounted(init)

  return {
    $addForm,
    addBillDialog,
    deleteBillDialog,
    shareBillDialog,
    quitBillDialog,
    membersDialog,
    members,
    membersLoading,
    typeManagerVisible,
    currentTypeBill,
    dialogLoading,
    bills,
    form,
    shareCode,
    userInfo,
    currentOperateBill,
    showBillDetail,
    showBillDialog,
    showTypeManager,
    showDeleteDialog,
    showQuitDialog,
    doQuitBill,
    showMembersDialog,
    removeMember,
    addBill,
    delBill,
    createShareBillCode,
  }
}
