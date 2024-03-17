import { onMounted, ref } from 'vue'
import { useBillStore } from '@/store'
import { getBillInfoApi } from '../api'

export const useBillDetail = () => {
  const store = useBillStore()

  const tab = ref('record')
  const billId = ref('')
  const showContent = ref(false)

  const getBillInfo = async () => {
    const params = { id: billId.value }
    const [err, res] = await getBillInfoApi({ params })
    showContent.value = true
    if (err) return
    store.updateBill(res.data)
  }

  onMounted(() => {
    const id = sessionStorage.getItem('billId') as string
    billId.value = id
    store.updateBillId(id)
    getBillInfo()
  })

  return { tab, showContent }
}
