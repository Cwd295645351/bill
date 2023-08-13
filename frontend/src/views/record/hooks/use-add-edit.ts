import { ref, Ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useBillStore } from '@/store'
import { addTransaction, deleteTransaction, editTransaction } from '../api'
import type { Information, InformationType } from '../type'
import type { Bill } from '@/types/bill'

export const useAddEdit = (options: { getCost: () => void; search: () => void; type: Ref<InformationType> }) => {
  const { getCost, type, search } = options

  const store = useBillStore()
  const { bill } = storeToRefs(store)

  /** 新增数据显示栏 */
  const showAdd = ref(false)

  const saveLoading = ref(false)
  const deleteDialog = ref(false)
  const editDialog = ref(false)
  const btnLoading = ref(false)

  /** 新增的账单明细 */
  const addInformation = ref<Information>({
    date: '',
    costTypeId: '',
    payMethodId: '',
    reimbursement: 0,
    belongUserId: '',
    incomesTypeId: '',
    money: 0,
    remark: '',
  })

  /** 正在编辑的账单明细 */
  const operateData = ref<Information>({
    id: '',
    billId: '',
    type: 1,
    date: '',
    costTypeId: '',
    payMethodId: '',
    reimbursement: 0,
    belongUserId: '',
    incomesTypeId: '',
    money: 0,
    remark: '',
  })

  /** 显示删除弹窗 */
  const showDeleteDialog = (detail: Information) => {
    operateData.value = detail
    deleteDialog.value = true
  }

  /** 显示编辑弹窗 */
  const showEditDialog = (detail: Information) => {
    operateData.value = detail
    editDialog.value = true
  }

  /** 删除交易明细 */
  const submitDeleteTransaction = async () => {
    const params = { id: operateData.value._id }
    btnLoading.value = true
    const [err, res] = await deleteTransaction({ params })
    btnLoading.value = false
    deleteDialog.value = false
    if (err) return
    if (res.retCode === 0) {
      ElMessage.success('删除交易明细成功')
      getCost()
      search()
    } else {
      ElMessage.error('删除交易明细失败，' + res.message)
    }
  }

  // 新增交易明细
  const addInfo = async () => {
    const information = addInformation.value
    const data: Information = {
      billId: (bill.value as Bill)._id,
      date: information.date,
      money: information.money,
      type: type.value,
      belongUserId: information.belongUserId,
      remark: information.remark,
    }
    if (type.value === 1) {
      data.costTypeId = information.costTypeId
      data.payMethodId = information.payMethodId
      data.reimbursement = information.reimbursement
    } else {
      data.incomesTypeId = information.incomesTypeId
    }
    saveLoading.value = true
    const [err, res] = await addTransaction({ data })
    saveLoading.value = false
    if (err) return
    if (res.retCode === 0) {
      ElMessage.success('新增交易明细成功')
      getCost()
      search()
    } else {
      ElMessage.error('新增交易明细失败')
    }
  }

  /** 编辑交易明细 */
  const submitEditTransaction = async () => {
    const currOperateData = operateData.value
    const data = {
      id: currOperateData.id,
      billId: currOperateData.billId,
      date: currOperateData.date,
      money: currOperateData.money,
      type: currOperateData.type,
      remark: currOperateData.remark,
      costTypeId: currOperateData.costTypeId,
      payMethodId: currOperateData.payMethodId,
      reimbursement: currOperateData.reimbursement,
      belongUserId: currOperateData.belongUserId,
    }
    btnLoading.value = true
    const [err, res] = await editTransaction({ data })
    btnLoading.value = false
    deleteDialog.value = false
    editDialog.value = false
    if (err) return
    if (res.retCode === 0) {
      ElMessage.success('编辑交易明细成功')
      getCost()
      search()
    } else {
      ElMessage.error('编辑交易明细失败，' + res.message)
    }
  }

  /** 切换新增数据栏显隐 */
  const changeAddContainer = () => {
    showAdd.value = !showAdd.value
  }

  return {
    showAdd,
    saveLoading,
    deleteDialog,
    editDialog,
    btnLoading,
    addInformation,
    operateData,
    showDeleteDialog,
    showEditDialog,
    submitDeleteTransaction,
    submitEditTransaction,
    addInfo,
    changeAddContainer,
  }
}
