import { ref, Ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useBillStore } from '@/store'
import { getUserInfo } from '@/utils/common-info'
import { addTransaction, batchAddTransaction, deleteTransaction, editTransaction, uploadTransactionImage } from '../api'
import { PUBLIC_OPTION, toSelectValue, useBelongSelect } from './use-belong-select'
import type { Information, InformationType, PhotoDraft } from '../type'
import type { Bill } from '@/types/bill'

const MAX_PHOTOS = 9
const MAX_PHOTO_BYTES = 10485760

/** 释放本地预览 URL，避免泄漏 */
const revokePreview = (draft: PhotoDraft) => {
  if (draft.viewUrl && draft.viewUrl.startsWith('blob:')) {
    try {
      URL.revokeObjectURL(draft.viewUrl)
    } catch (_) {
      /* ignore */
    }
  }
}

const clearDraftList = (list: Ref<PhotoDraft[]>) => {
  list.value.forEach(revokePreview)
  list.value = []
}

/** 本地校验并追加草稿（不上传） */
const appendLocalFiles = (target: Ref<PhotoDraft[]>, files: FileList | File[]) => {
  const list = Array.from(files || [])
  if (!list.length) return
  for (const file of list) {
    if (target.value.length >= MAX_PHOTOS) {
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
    const viewUrl = URL.createObjectURL(file)
    target.value = target.value.concat({
      file,
      sort: target.value.length,
      viewUrl,
    })
  }
}

/**
 * 按序上传仅含 file 的草稿，返回完整 imageIds（原图 id + 新 id）。
 * 失败返回 null，已成功上传的 id 仍在返回前的中间态，由调用方中止挂接。
 */
const uploadPendingFiles = async (
  billId: string,
  drafts: PhotoDraft[]
): Promise<string[] | null> => {
  const ids: string[] = []
  for (let i = 0; i < drafts.length; i++) {
    const draft = drafts[i]
    if (draft.id && !draft.file) {
      ids.push(draft.id)
      continue
    }
    if (!draft.file) {
      ElMessage.error('照片没有保存成功')
      return null
    }
    const [err, res] = await uploadTransactionImage({ data: { file: draft.file, billId } })
    if (err || !res || res.retCode !== 0 || !(res.data && res.data.id)) {
      ElMessage.error((res && res.message) || '照片没有保存成功')
      return null
    }
    // 上传成功后回写 id 并去掉 file，便于记账失败重试时只补传未成功的
    draft.id = res.data.id
    draft.file = undefined
    ids.push(res.data.id)
  }
  return ids
}

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

  /** 编辑弹窗照片草稿（原图 + 本地新选） */
  const editImages = ref<PhotoDraft[]>([])

  /** 新增表单照片草稿（仅本地，保存时再传） */
  const addImages = ref<PhotoDraft[]>([])

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

  /** 关闭编辑弹窗并丢弃本地新选（不上传） */
  const closeEditDialog = () => {
    editDialog.value = false
    clearDraftList(editImages)
  }

  // 弹窗被点遮罩等方式关闭时同样清理本地草稿
  watch(editDialog, (open, wasOpen) => {
    if (wasOpen && !open) {
      clearDraftList(editImages)
    }
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
    clearDraftList(editImages)
    editImages.value = imgs.map((img) => ({
      id: img.id,
      sort: img.sort || 0,
      viewUrl: img.viewUrl,
    }))
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

  /** 新增：有图则先上传再挂接；无图不传 imageIds */
  const addInfo = async () => {
    if (saveLoading.value || photoUploading.value) return
    const information = addInformation.value
    const belongUserIds = addBelongSelect.toBelongUserIds()
    if (type.value === 2 && belongUserIds.length !== 1) {
      ElMessage.warning('收入必须选一名归属人')
      return
    }
    const billId = (bill.value as Bill).id
    const data: Information = {
      billId,
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
    photoUploading.value = addImages.value.length > 0
    try {
      let imageIds: string[] | undefined
      if (addImages.value.length) {
        const uploaded = await uploadPendingFiles(billId, addImages.value)
        if (!uploaded) return
        imageIds = uploaded
      }
      const payload = imageIds ? { ...data, imageIds } : data
      const [err, res] = await addTransaction({ data: payload })
      if (err) return
      if (res.retCode === 0) {
        ElMessage.success('新增交易明细成功')
        clearDraftList(addImages)
        search()
      } else {
        ElMessage.error('新增交易明细失败，' + res.message)
      }
    } finally {
      photoUploading.value = false
      saveLoading.value = false
    }
  }

  /** 编辑时去掉一张照片 */
  const removeEditImage = (index: number) => {
    if (index < 0 || index >= editImages.value.length) return
    const removed = editImages.value[index]
    revokePreview(removed)
    editImages.value = editImages.value
      .filter((_, i) => i !== index)
      .map((img, i) => ({ ...img, sort: i }))
  }

  /** 新增时去掉一张照片 */
  const removeAddImage = (index: number) => {
    if (index < 0 || index >= addImages.value.length) return
    const removed = addImages.value[index]
    revokePreview(removed)
    addImages.value = addImages.value
      .filter((_, i) => i !== index)
      .map((img, i) => ({ ...img, sort: i }))
  }

  /** 编辑时补照片：仅本地草稿，不上传 */
  const addEditImages = (files: FileList | File[]) => {
    appendLocalFiles(editImages, files)
  }

  /** 新增时选照片：仅本地草稿，不上传 */
  const addAddImages = (files: FileList | File[]) => {
    appendLocalFiles(addImages, files)
  }

  /** 编辑：先上传新文件，再提交完整 imageIds */
  const submitEditTransaction = async () => {
    if (btnLoading.value || photoUploading.value) return
    const currOperateData = operateData.value
    const belongUserIds = editBelongSelect.toBelongUserIds()
    if (currOperateData.type === 2 && belongUserIds.length !== 1) {
      ElMessage.warning('收入必须选一名归属人')
      return
    }
    const billId = currOperateData.billId || (bill.value as Bill)?.id
    if (!billId) {
      ElMessage.error('未找到账本')
      return
    }

    btnLoading.value = true
    photoUploading.value = editImages.value.some((d) => !!d.file)
    try {
      const imageIds = await uploadPendingFiles(billId, editImages.value)
      if (!imageIds) return
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
      const [err, res] = await editTransaction({ data })
      if (err) return
      if (res.retCode === 0) {
        editDialog.value = false
        clearDraftList(editImages)
        ElMessage.success('编辑交易明细成功')
        search()
      } else {
        ElMessage.error('编辑交易明细失败，' + res.message)
      }
    } finally {
      photoUploading.value = false
      btnLoading.value = false
    }
  }

  /** 切换新增数据栏显隐；关闭时清空本地照片草稿 */
  const changeAddContainer = () => {
    const next = !showAdd.value
    if (!next) {
      clearDraftList(addImages)
    } else if (!addImages.value.length) {
      // 打开新增时保持空草稿
      addImages.value = []
    }
    showAdd.value = next
  }

  /** 批量新增交易明细（不传 imageIds） */
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
    addImages,
    showDeleteDialog,
    showEditDialog,
    closeEditDialog,
    submitDeleteTransaction,
    submitEditTransaction,
    addInfo,
    batchAdd,
    changeAddContainer,
    removeEditImage,
    removeAddImage,
    addEditImages,
    addAddImages,
  }
}
