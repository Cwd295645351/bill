import { Ref, onMounted, ref, watch } from 'vue'
import { useBillStore } from '@/store'
import { storeToRefs } from 'pinia'
import { getPlanList } from '../api'
import type { PlanItem } from '../type'

export const useList = () => {
  const store = useBillStore()
  const { bill, billId } = storeToRefs(store)

  const planList = ref<PlanItem[]>([])
  const total = ref(0)
  const notBuyCount = ref(0)

  watch(bill, (val) => {
    getList()
  })

  const getList = async () => {
    const params = { billId: billId.value }
    const [err, res] = await getPlanList({ params })
    if (err) return
    if (res.retCode === 0) {
      console.log(res.data)
      const data = res.data
      planList.value = data.details
      total.value = data.count
      notBuyCount.value = data.notBuyCount
    } else {
      ElMessage.error('查询计划列表失败，' + res.message)
    }
  }

  onMounted(() => {
    if (bill.value) getList()
  })

  return { getList, planList, total, notBuyCount }
}
