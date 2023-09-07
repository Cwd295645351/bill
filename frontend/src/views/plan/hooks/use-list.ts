import { Ref, onMounted, ref, watch } from 'vue'
import { useBillStore } from '@/store'
import { storeToRefs } from 'pinia'
import { getPlanList } from '../api'
import type { PlanItem, PlanResponse } from '../type'

export const useList = () => {
  const store = useBillStore()
  const { bill, billId } = storeToRefs(store)

  const planList = ref<{
    [index: number]: PlanItem[]
  }>([[], [], []])

  watch(bill, (val) => {
    getList()
  })

  const getList = async () => {
    const params = { billId: billId.value }
    planList.value = [[], [], []]
    const [err, res] = await getPlanList({ params })
    if (err) return
    if (res.retCode === 0) {
      const data = res.data
      data.details.forEach((item: PlanResponse) => {
        const obj: PlanItem = { _id: item._id, context: item.context, title: item.title, priority: item.priority }
        // 优先级数组下标需要 -1
        const priority = item.priority - 1
        planList.value[priority].push(obj)
      })
    } else {
      ElMessage.error('查询计划列表失败，' + res.message)
    }
  }

  onMounted(() => {
    if (bill.value) getList()
  })

  return { getList, planList }
}
