import { guardPage } from '../../../utils/auth'

Page({
  data: {
    billId: ''
  },
  onLoad(query: Record<string, string>) {
    this.setData({ billId: query.billId || query.id || '' })
  },
  async onShow() {
    await guardPage()
  }
})
