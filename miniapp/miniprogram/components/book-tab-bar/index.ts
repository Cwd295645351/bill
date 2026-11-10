/** 账本内五大模块 → 各自独立分包路径 */
const BOOK_ROUTES: Record<string, (billId: string) => string> = {
  detail: (id) => `/packageDetail/pages/bill-detail/index?id=${id}`,
  overview: (id) => `/packageOverview/pages/overview/index?billId=${id}`,
  budget: (id) => `/packageBudget/pages/budget/index?billId=${id}`,
  plan: (id) => `/packagePlan/pages/plan/index?billId=${id}`,
  asset: (id) => `/packageAsset/pages/asset/index?billId=${id}`
}

Component({
  properties: {
    billId: { type: String, value: '' },
    active: { type: String, value: 'detail' }
  },
  methods: {
    onTap(e: WechatMiniprogram.TouchEvent) {
      const key = e.currentTarget.dataset.key as string
      const billId = this.data.billId
      if (!billId) return
      if (key === this.data.active) return
      const toUrl = BOOK_ROUTES[key]
      if (!toUrl) return
      wx.redirectTo({ url: toUrl(billId) })
    }
  }
})
