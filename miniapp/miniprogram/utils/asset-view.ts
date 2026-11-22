/** 小程序本次查看的资产显示状态。离开资产页或换账本后清空。 */

type AssetViewState = {
  billId: string
  memberId: string
  excludeFixed: boolean
  hideAmount: boolean
  compareDay: string
  ledgerYear: number | null
}

const state: AssetViewState = {
  billId: '',
  memberId: '',
  excludeFixed: false,
  hideAmount: false,
  compareDay: '',
  ledgerYear: null
}

export function assetViewState() {
  return state
}

export function resetAssetView() {
  state.memberId = ''
  state.excludeFixed = false
  state.hideAmount = false
  state.compareDay = ''
  state.ledgerYear = null
}

/** 账本变了就回到「全部」，并关掉只在本次查看里有效的开关。 */
export function bindAssetBill(billId: string) {
  if (state.billId === billId) return
  state.billId = billId
  resetAssetView()
}
