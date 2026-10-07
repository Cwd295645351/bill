import { addTransaction, getBillDetail } from '../../apis/index'
import { guardPage } from '../../utils/auth'
import { setBillDict, setLastBillId, setLastPref } from '../../utils/storage'

/** 从账本详情进入的记账页，保留页面栈，未保存也可以返回 */
Page({
  data: {
    billId: '',
    bill: null as any,
    billName: '',
    saving: false
  },

  onLoad(query: Record<string, string>) {
    this.setData({ billId: query.billId || '' })
  },

  async onShow() {
    const ok = await guardPage()
    if (!ok) return
    if (!this.data.billId) {
      wx.navigateBack()
      return
    }
    if (this.data.bill) return
    const res = await getBillDetail(this.data.billId)
    if (res.retCode !== 0 || !res.data) return
    setBillDict(this.data.billId, res.data)
    setLastBillId(this.data.billId)
    wx.setNavigationBarTitle({ title: res.data.name || '记一笔' })
    this.setData({ bill: res.data, billName: res.data.name || '' })
  },

  async onSubmit(e: WechatMiniprogram.CustomEvent) {
    if (this.data.saving) return
    const { payload, again, pref } = e.detail
    this.setData({ saving: true })
    const res = await addTransaction(payload)
    this.setData({ saving: false })
    if (res.retCode !== 0) return
    setLastPref(pref)
    wx.showToast({ title: '已保存' })
    if (again) {
      const form = this.selectComponent('#form') as any
      if (form && form.resetForAgain) form.resetForAgain()
      return
    }
    wx.navigateBack()
  }
})
