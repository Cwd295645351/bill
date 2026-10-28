import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface BillMember {
  id: string
  name: string
}

export interface BillDetail {
  id: string
  name: string
  creator?: string
  users?: BillMember[]
  costTypes?: any[]
  incomesTypes?: any[]
  [key: string]: any
}

const LAST_BILL_KEY = 'lastBillId'

export const useBillContextStore = defineStore('bill-context', () => {
  const currentBillId = ref<string>(sessionStorage.getItem(LAST_BILL_KEY) || '')
  const currentBillName = ref<string>('')
  const currentBill = ref<BillDetail | null>(null)

  function setCurrentBill(bill: BillDetail | null) {
    currentBill.value = bill
    currentBillId.value = bill?.id || ''
    currentBillName.value = bill?.name || ''
    if (bill?.id) sessionStorage.setItem(LAST_BILL_KEY, bill.id)
  }

  function setCurrentBillId(id: string, name?: string) {
    currentBillId.value = id
    if (name) currentBillName.value = name
    if (id) sessionStorage.setItem(LAST_BILL_KEY, id)
  }

  function clearBillContext() {
    currentBill.value = null
    currentBillId.value = ''
    currentBillName.value = ''
  }

  return {
    currentBillId,
    currentBillName,
    currentBill,
    setCurrentBill,
    setCurrentBillId,
    clearBillContext,
  }
})
