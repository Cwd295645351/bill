import { defineStore } from 'pinia'
import { ref, reactive, Ref } from 'vue'
import type { Bill } from '@/types/bill'

const refObjects = reactive<{ [key: string]: Ref<any> }>({})

export const useBillStore = defineStore('bill', () => {
  /** 当前账本id */
  const billId = ref<string | null>(null)
  /** 当前账本 */
  const bill = ref<Bill | null>(null)
  /** 当前账本是否更新 */
  const updateBill = ref(false)

  refObjects['updateBill'] = updateBill
  refObjects['billId'] = billId
  refObjects['bill'] = bill

  const updateState = (payload: { key: string; value: any } | { key: string; value: any }[]) => {
    if (Array.isArray(payload)) {
      payload.forEach((item) => {
        changeValueByKey(item.key, item.value)
      })
    } else {
      changeValueByKey(payload.key, payload.value)
    }
  }

  /** 修改内容 */
  const changeValueByKey = (key: string, value: any) => {
    // Check if the key exists in refObjects
    if (refObjects.hasOwnProperty(key)) {
      const refObj = refObjects[key]
      // Check if the refObj is a Ref object
      if (typeof refObj?.value !== 'undefined' && typeof refObj?.value !== null) {
        refObj.value = value
      } else {
        // If refObj is not a Ref object, directly assign the value
        refObjects[key] = value
      }
    } else {
      console.error(`Key "${key}" not found in refObjects.`)
    }
  }

  return { billId, bill, updateBill, updateState }
})
