import { ref, type Ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useBillStore } from '@/store'
import { getOverview } from '../api'
import type { AssetOverview } from '../type'

const emptyOverview = (): AssetOverview => ({
  netAmount: 0,
  assetAmount: 0,
  debtAmount: 0,
  referenceDate: '',
  totalChange: 0,
  categoryChanges: [],
})

/** 上月末对比。页面按原型用横向色条展示当前和上月末 */
export const useMonthBars = (memberId: Ref<string>) => {
  const { billId } = storeToRefs(useBillStore())
  const summary = ref<AssetOverview>(emptyOverview())

  const load = async () => {
    if (!billId.value) {
      summary.value = emptyOverview()
      return
    }
    const params: { billId: string; memberId?: string } = { billId: billId.value }
    if (memberId.value) params.memberId = memberId.value
    const [err, res] = await getOverview({ params })
    if (err || !res || res.retCode !== 0) {
      if (res?.message) ElMessage.error(res.message)
      return
    }
    summary.value = res.data || emptyOverview()
  }

  return { summary, load }
}
