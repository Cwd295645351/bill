import { ref, Ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useBillStore } from '@/store'
import { getUserInfo } from '@/utils/common-info'
import { addTransaction, batchAddTransaction, deleteTransaction, editTransaction, uploadTransactionImage } from '../api'
import { PUBLIC_OPTION, toSelectValue, useBelongSelect } from './use-belong-select'
import type { Information, InformationType, RecordImage } from '../type'
import type { Bill } from '@/types/bill'

const MAX_PHOTOS = 9
const MAX_PHOTO_BYTES = 10485760

export const useAddEdit = (options: { search: () => void; type: Ref<InformationType> }) => {
  const { type, search } = options

  const store = useBillStore()
  const { bill } = storeToRefs(store)

  /** 新增数据显示栏 */
  const showAdd = ref(false)

  const saveLoading = ref(false)
  const deleteDialog = ref(false)
  const editDialog = ref(false)
  const btnLoading = ref(false)
  const photoUploading = ref(false)

  /** 编辑弹窗中的照片列表（含原图与新上传） */
  const editImages = ref<RecordImage[]>([])

  /** 新增的账单明细 */
  const addInformation = ref<Information>({
    date: '',
    costTypeId: '',
    payMethodId: '',
    reimbursement: 0,
    belongUserIds: [],
    incomesTypeId: '',
    money: 0,
    remark: '',
  })

  const selfId = () => getUserInfo().userId

  /** 新增表单的归属人下拉值 */
  const addBelong = ref<string[]>(type.value === 2 ? [selfId()] : [PUBLIC_OPTION])
  const addBelongSelect = useBelongSelect(addBelong, type, { selfId, watchType: true, notify: () => showAdd.value })

  /** 编辑弹窗的归属人下拉值；弹窗内收支类型固定 */
  const editBelong = ref<string[]>([PUBLIC_OPTION])
  const editBelongSelect = useBelongSelect(editBelong, type, { selfId })

  /** 正在编辑的账单明细 */
  const operateData = ref<Information>({
    id: '',
    billId: '',
    type: 1,
    date: '',
    costTypeId: '',
    payMethodId: '',
    reimbursement: 0,
    belongUserIds: [],
    incomesTypeId: '',
    money: 0,
    remark: '',
  })

  /** 显示删除弹窗 */
  const showDeleteDialog = (detail: Information) => {
    operateData.value = detail
    deleteDialog.value = true
  }

  /** 显示编辑弹窗：克隆明细与照片，未保存关闭不影响列表 */
  const showEditDialog = (detail: Information) => {
    operateData.value = { ...detail }
    editBelong.value = toSelectValue(detail.belongUserIds)
    const imgs = Array.isArray(detail.images) ? detail.images.slice() : []
    imgs.sort((a, b) => (a.sort || 0) - (b.sort || 0))
    editImages.value = imgs.map((img) => ({ ...img }))
    editDialog.value = true
  }

  /** 删除交易明细 */
  const submitDeleteTransaction = async () => {
    const params = { id: operateData.value.id }
    btnLoading.value = true
    const [err, res] = await deleteTransaction({ params })
    btnLoading.value = false
    deleteDialog.value = false
    if (err) return
    if (res.retCode === 0) {
      ElMessage.success('删除交易明细成功')
      search()
    } else {
      ElMessage.error('删除交易明细失败，' + res.message)
    }
  }

  // 新增交易明细（不传 imageIds，电脑端新增不附图）
  const addInfo = async () => {
    const information = addInformation.value
    const belongUserIds = addBelongSelect.toBelongUserIds()
    if (type.value === 2 && belongUserIds.length !== 1) {
      ElMessage.warning('收入必须选一名归属人')
      return
    }
    const data: Information = {
      billId: (bill.value as Bill).id,
      date: Number(information.date),
      money: information.money,
      type: type.value,
      belongUserIds,
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
      search()
    } else {
      ElMessage.error('新增交易明细失败，' + res.message)
    }
  }

  /** 编辑时去掉一张照片 */
  const removeEditImage = (index: number) => {
    if (index < 0 || index >= editImages.value.length) return
    editImages.value = editImages.value.filter((_, i) => i !== index)
  }

  /** 编辑时补照片 */
  const addEditImages = async (files: FileList | File[]) => {
    const list = Array.from(files || [])
    if (!list.length) return
    const billId = operateData.value.billId || (bill.value as Bill)?.id
    if (!billId) {
      ElMessage.error('未找到账本')
      return
    }
    photoUploading.value = true
    try {
      for (const file of list) {
        if (editImages.value.length >= MAX_PHOTOS) {
          ElMessage.warning('最多 9 张')
          break
        }
        if (!file.type || !/^image\/(jpeg|png|gif|webp)$/i.test(file.type)) {
          ElMessage.warning('无法当作照片打开')
          continue
        }
        if (file.size > MAX_PHOTO_BYTES) {
          ElMessage.warning('单张照片不能超过 10MB')
          continue
        }
        const [err, res] = await uploadTransactionImage({ data: { file, billId } })
        if (err || !res || res.retCode !== 0 || !(res.data && res.data.id)) {
          ElMessage.error((res && res.message) || '照片没有保存成功')
          continue
        }
        const localUrl = URL.createObjectURL(file)
        editImages.value = editImages.value.concat({
          id: res.data.id,
          sort: editImages.value.length,
          viewUrl: localUrl,
        })
      }
    } finally {
      photoUploading.value = false
    }
  }

  /** 编辑交易明细：始终提交当前 imageIds（含未改动的原 id） */
  const submitEditTransaction = async () => {
    if (btnLoading.value || photoUploading.value) return
    const currOperateData = operateData.value
    const imageIds = editImages.value.map((img) => img.id)
    const belongUserIds = editBelongSelect.toBelongUserIds()
    if (currOperateData.type === 2 && belongUserIds.length !== 1) {
      ElMessage.warning('收入必须选一名归属人')
      return
    }
    const data = {
      id: currOperateData.id,
      billId: currOperateData.billId,
      date: Number(currOperateData.date),
      money: currOperateData.money,
      type: currOperateData.type,
      remark: currOperateData.remark,
      costTypeId: currOperateData.costTypeId,
      payMethodId: currOperateData.payMethodId,
      reimbursement: currOperateData.reimbursement,
      belongUserIds,
      incomesTypeId: currOperateData.incomesTypeId,
      imageIds,
    }
    btnLoading.value = true
    const [err, res] = await editTransaction({ data })
    btnLoading.value = false
    if (err) return
    if (res.retCode === 0) {
      editDialog.value = false
      ElMessage.success('编辑交易明细成功')
      search()
    } else {
      // 失败时不关弹窗，保留用户刚改的内容与照片
      ElMessage.error('编辑交易明细失败，' + res.message)
    }
  }

  /** 切换新增数据栏显隐 */
  const changeAddContainer = () => {
    showAdd.value = !showAdd.value
  }

  /** 批量新增交易明细 */
  const batchSaving = ref(false)
  const batchAdd = async (list: Array<{ costTypeId: string; money: number; date: number; remark: string; belongUserId: string }>) => {
    const billId = (bill.value as Bill).id
    const data = list.map((item) => ({
      billId,
      type: type.value,
      date: item.date,
      money: item.money,
      belongUserIds: item.belongUserId ? [item.belongUserId] : [],
      remark: item.remark,
      costTypeId: item.costTypeId,
      payMethodId: '',
      reimbursement: 0,
    }))
    batchSaving.value = true
    const [err, res] = await batchAddTransaction({ data: { list: data } })
    batchSaving.value = false
    if (err) return false
    if (res.retCode === 0) {
      ElMessage.success('批量新增成功')
      search()
      return true
    } else {
      ElMessage.error('批量新增失败，' + res.message)
      return false
    }
  }

  return {
    showAdd,
    saveLoading,
    batchSaving,
    deleteDialog,
    editDialog,
    btnLoading,
    photoUploading,
    addInformation,
    addBelong,
    onAddBelongChange: addBelongSelect.onExpenseChange,
    addIncomeBelong: addBelongSelect.incomeValue,
    operateData,
    editBelong,
    onEditBelongChange: editBelongSelect.onExpenseChange,
    editIncomeBelong: editBelongSelect.incomeValue,
    editImages,
    showDeleteDialog,
    showEditDialog,
    submitDeleteTransaction,
    submitEditTransaction,
    addInfo,
    batchAdd,
    changeAddContainer,
    removeEditImage,
    addEditImages,
  }
}
