import { appShareBehavior } from '../../../behaviors/app-share'
import { guardPage } from '../../../utils/auth'

Page({
  behaviors: [appShareBehavior],
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
