import { ref } from 'vue'
import { useBillStore } from '@/store'
import { storeToRefs } from 'pinia'
import { planAdd } from '../api'
import type { PlanForm } from '../type'

export const useAddInfo = (getList: Function) => {
  const store = useBillStore()
  const { billId } = storeToRefs(store)

  const $addForm = ref()
  const btnLoading = ref(false)

  const info = ref<PlanForm>({
    billId: '',
    context: '',
    title: '',
    priority: 1,
  })

  const reset = () => {
    info.value = { billId: billId.value as string, context: '', title: '', priority: 1 }
    $addForm.value.resetFields()
  }

  const submitAdd = () => {
    $addForm.value.validate(async (valid: boolean) => {
      if (valid) {
        const data = info.value

        btnLoading.value = true
        const [err, res] = await planAdd({ data })
        btnLoading.value = false
        if (err) return
        if (res.retCode === 0) {
          ElMessage.success('新增计划成功')
          getList()
        } else {
          ElMessage.error('新增计划失败，' + res.message)
        }
      } else {
        return false
      }
    })
  }

  return { $addForm, info, btnLoading, reset, submitAdd }
}
