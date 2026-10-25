import { ref, type Ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useBillStore } from '@/store'
import { editAsset, getFourMoney } from '../api'
import type { FourMoneyAsset, FourMoneySummary } from '../type'

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

  /** 只改四笔钱。金额用原币，避免被当成金额变化而新增盘点 */
  const move = async (item: FourMoneyAsset, fourMoneyType: string) => {
    const [err, res] = await editAsset({
      data: {
        id: item.id,
        name: item.name,
        memberId: item.memberId,
        type: item.type,
        fourMoneyType,
        latestAmount: item.rawAmount ?? item.latestAmount,
        currency: item.currency || 'CNY',
        channel: item.isDebt ? '' : item.channel || '',
        turnaroundCycle: item.isDebt ? 'T+0' : item.turnaroundCycle || 'T+0',
        insuranceCategory: fourMoneyType === 'insurance' ? '' : '',
        annualPremium: '',
      },
    })
    if (err || !res || res.retCode !== 0) {
      ElMessage.error(res?.message || '修改分类失败')
      return false
    }
    await load()
    return true
  }

  return { summary, order, load, move }
}
