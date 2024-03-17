import { ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useBillStore } from '@/store'
import { getBudgetListApi, getCurrentMonthCostApi } from '../api'
import type { Budget } from '@/types/bill'
export const useBudget = () => {
  const store = useBillStore()
  const { billId } = storeToRefs(store)
  const budgetInfo = ref<Budget>({
    date: 2024,
    details: [],
    totalBudget: 0,
    currCost: 0,
    currentMonthCost: '0',
    restBudget: 0,
  })

  /** 查询预算 */
  const getBudgetInfo = async () => {
    const params = {
      date: new Date().getFullYear(),
      billId: billId?.value,
    }
    const [err, res] = await getBudgetListApi({ params })
    if (err) return
    budgetInfo.value = res.data
    budgetInfo.value.restBudget = budgetInfo.value.totalBudget - budgetInfo.value.currCost
    getCurrentMonthCost()
  }

  /** 查询当月花费 */
  const getCurrentMonthCost = async () => {
    const params = { billId: billId?.value }
    const [err, res] = await getCurrentMonthCostApi({ params })
    if (err) return
    budgetInfo.value.currentMonthCost = res.data.totalCost
  }

  watch(billId, getBudgetInfo, { immediate: true })
  return { budgetInfo, getBudgetInfo }
}
