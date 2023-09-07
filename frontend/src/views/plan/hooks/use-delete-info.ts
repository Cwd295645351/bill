import { ref, nextTick } from 'vue'
import { useBillStore } from '@/store'
import { storeToRefs } from 'pinia'
import { planDelete } from '../api'

export const useDeleteInfo = (getList: Function) => {
  const store = useBillStore()
  const { billId } = storeToRefs(store)

  const deleteDialog = ref(false)
  const delelteId = ref('')

  /** 显示删除弹窗 */
  const showDelete = (id: string) => {
    delelteId.value = id
    deleteDialog.value = true
  }

  /** 删除计划 */
  const submitDelete = async () => {
    const params = { billId: billId.value, id: delelteId.value }
    const [err, res] = await planDelete({ params })
    if (err) return
    deleteDialog.value = false
    if (res.retCode === 0) {
      ElMessage.success('删除计划成功')
      getList()
    } else {
      ElMessage.error('删除计划失败，' + res.message)
    }
  }
  return { deleteDialog, showDelete, submitDelete }
}
