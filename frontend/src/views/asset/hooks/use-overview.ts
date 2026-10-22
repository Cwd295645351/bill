import { ref, watch, type Ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useBillStore } from '@/store'
import { getAssetListStats, getOverview } from '../api'
import type { AssetOverview, AssetStats, CategoryChange } from '../type'

const emptyStats = (): AssetStats => ({
  assetAmount: 0,
  debtAmount: 0,
  netAmount: 0,
  assetGroups: [],
  debtGroups: [],
})

const emptyOverview = (): AssetOverview => ({
  netAmount: 0,
  assetAmount: 0,
  debtAmount: 0,
  referenceDate: '',
  totalChange: 0,
  debtChange: 0,
  categoryChanges: [],
  defaultAsOf: '',
  earliestRecordMonth: '',
  hkdRate: 0,
  usdRate: 0,
})

/** 总览。合计用截至日，分组仍是较每笔自己的上一次盘点 */
export const useOverview = (memberId: Ref<string>) => {
  const { billId } = storeToRefs(useBillStore())
  const stats = ref<AssetStats>(emptyStats())
  const summary = ref<AssetOverview>(emptyOverview())
  const asOf = ref('')
  /** 为假时，下次加载改回这个筛选的上一个盘点日 */
  const manual = ref(false)

  const load = async () => {
    if (!billId.value) {
      stats.value = emptyStats()
      summary.value = emptyOverview()
      asOf.value = ''
      return
    }
    const base: { billId: string; memberId?: string } = { billId: billId.value }
    if (memberId.value) base.memberId = memberId.value
    const [statErr, statRes] = await getAssetListStats({ params: base })
    if (!statErr && statRes?.retCode === 0) stats.value = statRes.data || emptyStats()
    else if (statRes?.message) ElMessage.error(statRes.message)

    const [probeErr, probeRes] = await getOverview({ params: base })
    if (probeErr || !probeRes || probeRes.retCode !== 0) {
      if (probeRes?.message) ElMessage.error(probeRes.message)
      return
    }
    const probe = probeRes.data || emptyOverview()
    const day = manual.value ? asOf.value : probe.defaultAsOf || ''
    asOf.value = day
    if (!day) {
      summary.value = {
        ...probe,
        totalChange: 0,
        debtChange: 0,
        referenceDate: '',
        categoryChanges: (probe.categoryChanges || []).map((item: CategoryChange) => ({ ...item, prev: item.current, change: 0 })),
      }
      return
    }
    const [err, res] = await getOverview({ params: { ...base, asOf: day } })
    if (err || !res || res.retCode !== 0) {
      if (res?.message) ElMessage.error(res.message)
      return
    }
    summary.value = res.data || emptyOverview()
  }

  const setAsOf = (value: string) => {
    manual.value = true
    asOf.value = value || ''
    return load()
  }

  watch(memberId, () => {
    manual.value = false
  })

  return { stats, summary, asOf, load, setAsOf }
}
