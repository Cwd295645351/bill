import { ref } from 'vue'
import { defineStore } from 'pinia'
import type { Bill } from '@/types/bill'

export const useBillStore = defineStore('bill', () => {
  /** 当前账本id */
  const billId = ref<string | null>(null)
  /** 当前账本 */
  const bill = ref<Bill | null>(null)

  const updateBillId = (id: string | null) => {
    billId.value = id
  }

  const updateBill = (billInfo: Bill) => {
    bill.value = billInfo
  }

  return { billId, bill, updateBillId, updateBill }
})
