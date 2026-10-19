import { ref, type Ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useBillStore } from '@/store'
import { getAssetListStats } from '../api'
import type { AssetStats } from '../type'

const emptyStats = (): AssetStats => ({
  assetAmount: 0,
  debtAmount: 0,
  netAmount: 0,
  assetGroups: [],
  debtGroups: [],
})

/** 总览分组。成员筛选为空时表示整个账本 */
export const useOverview = (memberId: Ref<string>) => {
  const { billId } = storeToRefs(useBillStore())
  const stats = ref<AssetStats>(emptyStats())

  const load = async () => {
    if (!billId.value) {
      stats.value = emptyStats()
      return
    }
    const params: { billId: string; memberId?: string } = { billId: billId.value }
    if (memberId.value) params.memberId = memberId.value
    const [err, res] = await getAssetListStats({ params })
    if (err || !res || res.retCode !== 0) {
      if (res?.message) ElMessage.error(res.message)
      return
    }
    stats.value = res.data || emptyStats()
  }

  return { stats, load }
}
