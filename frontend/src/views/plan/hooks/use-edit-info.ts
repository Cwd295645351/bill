import { ref, nextTick } from 'vue'
import { useBillStore } from '@/store'
import { storeToRefs } from 'pinia'
import { planEdit } from '../api'
import type { PlanForm, PlanItem } from '../type'

export const useEditInfo = (getList: Function) => {
  const store = useBillStore()
  const { billId } = storeToRefs(store)
  const $editForm = ref()
  const btnLoading = ref(false)
  const editDialog = ref(false)

  const editInfo = ref<PlanForm>({
    id: '',
    billId: '',
    context: '',
    title: '',
    priority: 1,
  })

  /** 显示编辑弹窗 */
  const showEdit = (item: PlanItem) => {
    editDialog.value = true
    nextTick(() => {
      editInfo.value = {
        id: item._id,
        billId: billId.value as string,
        context: item.context,
        title: item.title,
        priority: item.priority,
      }
      $editForm.value.resetFields()
    })
  }

  const submitEdit = () => {
    $editForm.value.validate(async (valid: boolean) => {
      if (valid) {
        const data = editInfo.value

        btnLoading.value = true
        const [err, res] = await planEdit({ data })
        btnLoading.value = false
        editDialog.value = false
        if (err) return
        if (res.retCode === 0) {
          ElMessage.success('编辑计划成功')
          getList()
        } else {
          ElMessage.error('编辑计划失败，' + res.message)
        }
      } else {
        return false
      }
    })
  }
  return { editDialog, $editForm, editInfo, btnLoading, showEdit, submitEdit }
}
