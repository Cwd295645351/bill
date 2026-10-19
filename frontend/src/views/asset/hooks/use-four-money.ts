import { ref, type Ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useBillStore } from '@/store'
import { getFourMoney } from '../api'
import type { FourMoneySummary } from '../type'

/** 四笔钱。负债仍落在所选分类里，不从卡片中剔除 */
export const useFourMoney = (memberId: Ref<string>) => {
  const { billId } = storeToRefs(useBillStore())
  const summary = ref<FourMoneySummary>({})
  const order = ['living', 'steady', 'longterm', 'insurance']

  const load = async () => {
    if (!billId.value) {
      summary.value = {}
      return
    }
    const params: { billId: string; memberId?: string } = { billId: billId.value }
    if (memberId.value) params.memberId = memberId.value
    const [err, res] = await getFourMoney({ params })
    if (err || !res || res.retCode !== 0) {
      if (res?.message) ElMessage.error(res.message)
      return
    }
    summary.value = res.data || {}
  }

  return { summary, order, load }
}
