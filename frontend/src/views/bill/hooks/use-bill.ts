import { ref, onMounted, watch } from 'vue'
import { storeToRefs } from 'pinia'
import router from '@/router'
import { useBillStore } from '@/store'
import { getUserInfo } from '@/utils/common-info'
import { createBill, getBillList, deleteBill, shareBill } from '../api'
import type { UserInfo } from '@/types/user-info'
import type { Bill } from '../type'

export const useBill = () => {
  const store = useBillStore()
  const { updateBill } = storeToRefs(store)

  const $addForm = ref()

  const addBillDialog = ref(false)
  const deleteBillDialog = ref(false)
  const shareBillDialog = ref(false)
  const dialogLoading = ref(false)
  const bills = ref<Bill[]>([])
  const form = ref({ name: '' })
  const currentOperateBill = ref<Bill>({ id: '', _id: '', name: '', creator: '' })
  const shareCode = ref('') // 分享码
  const userInfo = ref<UserInfo>({ accessToken: '', refreshToken: '', userId: '', expiresIn: 0, avatarUrl: '', nickName: '', expenses: 0, incomes: 0 })

  watch(updateBill, (val) => {
    // 为 true 表示已加入新账本，需要刷新账本列表数据，并重置标识符为 false
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
      bills.value = res.data.map((item: Bill) => {
        item.id = item._id
        return item
      })
    } else {
      ElMessage.error('获取账本列表失败，' + res.message)
    }
  }

  /** 查看账本详情 */
  const showBillDetail = async (item: Bill) => {
    sessionStorage.setItem('billId', item._id)
    sessionStorage.setItem('tabValue', 'record')
    sessionStorage.setItem('billId', item._id)
    store.updateState({ key: 'billId', value: item._id })
    router.push('/layout/record')
  }

  /** 显示新增账本弹窗 */
  const showBillDialog = () => {
    form.value.name = ''
    addBillDialog.value = true
  }

  /** 显示删除账本弹窗 */
  const showDeleteDialog = (item: Bill) => {
    deleteBillDialog.value = true
    currentOperateBill.value = item
  }

  /** 新增账本 */
  const addBill = async () => {
    $addForm.value.validate(async (valid: boolean) => {
      console.log(valid)
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

  /** 删除账本 */
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

  /** 分享账本，生成分项码 */
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
    dialogLoading,
    bills,
    form,
    shareCode,
    userInfo,
    showBillDetail,
    showBillDialog,
    showDeleteDialog,
    addBill,
    delBill,
    createShareBillCode,
  }
}
