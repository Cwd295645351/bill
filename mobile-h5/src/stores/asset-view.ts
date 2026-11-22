import { defineStore } from 'pinia'
import { ref } from 'vue'

/** 本次查看的显示开关。不入库。离开资产或换账本后回到默认。 */
export const useAssetViewStore = defineStore('asset-view', () => {
  const billId = ref('')
  const memberId = ref('')
  const excludeFixed = ref(false)
  const hideAmount = ref(false)
  const compareDay = ref('')
  const ledgerYear = ref<number | null>(null)

  function reset() {
    memberId.value = ''
    excludeFixed.value = false
    hideAmount.value = false
    compareDay.value = ''
    ledgerYear.value = null
  }

  /** 换账本时清空筛选和开关。同一账本重复进入不在这里重置。 */
  function bindBill(id: string) {
    if (billId.value === id) return
    billId.value = id
    reset()
  }

  return { billId, memberId, excludeFixed, hideAmount, compareDay, ledgerYear, reset, bindBill }
})
