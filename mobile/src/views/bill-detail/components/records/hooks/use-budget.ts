import { ref, Ref, watch } from 'vue'
import { getBudgetListApi } from '../api'
import type { Budget } from '@/types/bill'
export const useBudget = (billId: Ref<string>) => {
  const budgetInfo = ref<Budget>({
    date: 2024,
    details: [],
    totalBudget: 0,
    currCost: 0,
    restBudget: 0,
  })

  const getBudgetInfo = async () => {
    const params = {
      date: new Date().getFullYear(),
      billId: billId?.value,
    }
    const [err, res] = await getBudgetListApi({ params })
    if (err) return
    budgetInfo.value = res.data
    budgetInfo.value.restBudget = budgetInfo.value.totalBudget - budgetInfo.value.currCost
  }

  watch(
    billId,
    (newValue) => {
      console.log(newValue, '===')
      getBudgetInfo()
    },
    { immediate: true },
  )
  return { budgetInfo, getBudgetInfo }
}
