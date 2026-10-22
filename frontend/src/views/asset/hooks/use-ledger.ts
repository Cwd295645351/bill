import { ref, watch, type Ref } from 'vue'
import dayjs from 'dayjs'
import { storeToRefs } from 'pinia'
import { useBillStore } from '@/store'
import { getLedger } from '../api'

export interface LedgerQuantityRule {
  id: string
  name: string
  unitName: string
  unitPrice: number
  quantity: number
  belongUserId: string
  belongUserName: string
}

export interface LedgerResult {
  year: number
  years: number[]
  endMonth: string
  openingMonth: string
  openingAsset: number | null
  closingAsset: number | null
  income: number
  expense: number
  surplus: number
  exclusive: number
  sharedShare: number
  publicShare: number
  effectiveIncome: { userId: string; name: string; effectiveIncome: number }[]
  unmatched: boolean
  message: string
  assetChange: number | null
  netChange: number | null
  diff: number | null
  equal: boolean | null
  quantityRules: LedgerQuantityRule[]
}

/** 年度对账。直接读取已配置的规则数据，切换年份与成员时自动加载 */
export const useLedger = (memberId: Ref<string>) => {
  const { billId } = storeToRefs(useBillStore())
  const year = ref(dayjs().year())
  const years = ref<number[]>([year.value])
  const result = ref<LedgerResult | null>(null)

  const load = async () => {
    if (!billId.value) {
      result.value = null
      return
    }
    const [err, res] = await getLedger({
      data: {
        billId: billId.value,
        year: year.value,
        memberId: memberId.value || undefined,
      },
    })
    if (err || !res || res.retCode !== 0) {
      if (res?.message) ElMessage.error(res.message)
      return
    }
    const data = res.data as LedgerResult
    result.value = data
    const listed = (data.years || []).filter((item) => Number.isFinite(item))
    years.value = listed.length ? listed : [dayjs().year()]
    if (!years.value.includes(year.value)) year.value = years.value[years.value.length - 1]
  }

  watch(year, () => load())

  return { year, years, result, load }
}
