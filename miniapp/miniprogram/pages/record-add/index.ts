import { addTransaction, getBillDetail, getBillList } from '../../apis/index'
import { guardPage } from '../../utils/auth'
import { getLastBillId, setBillDict, setLastBillId, setLastPref } from '../../utils/storage'

Page({
  data: {
    bills: [] as any[],
    billNames: [] as string[],
    bill: null as any,
    billName: '请选择账本',
    showBills: false,
    saving: false
  },

  async onShow() {
    const ok = await guardPage()
    if (!ok) return
    await this.loadBills()
  },

  async loadBills() {
    const res = await getBillList()
    const bills = res.retCode === 0 && Array.isArray(res.data) ? res.data : []
    const names = bills.map((item) => item.name)
    this.setData({ bills, billNames: names })
    if (!bills.length) {
      this.setData({ bill: null, billName: '还没有账本' })
      return
    }
    const last = getLastBillId()
    const current = bills.find((item) => item.id === last) || bills[0]
    if (!this.data.bill || this.data.bill.id !== current.id) {
      await this.useBill(current.id, current.name)
    }
  },

  async useBill(id: string, name: string) {
    setLastBillId(id)
    const res = await getBillDetail(id)
    if (res.retCode !== 0 || !res.data) return
    setBillDict(id, res.data)
    this.setData({ bill: res.data, billName: name || res.data.name })
  },

  openBills() {
    if (!this.data.bills.length) {
      wx.switchTab({ url: '/pages/bills/index' })
      return
    }
    this.setData({ showBills: true })
  },

  closeBills() {
    this.setData({ showBills: false })
  },

  onPickBill(e: WechatMiniprogram.CustomEvent) {
    const raw = e.detail.index
    const index = Array.isArray(raw) ? raw[0] : raw
    const bill = this.data.bills[index]
    this.setData({ showBills: false })
    if (bill) this.useBill(bill.id, bill.name)
  },

  goBills() {
    wx.switchTab({ url: '/pages/bills/index' })
  },

  async onSubmit(e: WechatMiniprogram.CustomEvent) {
    if (this.data.saving) return
    const { payload, again, pref } = e.detail
    this.setData({ saving: true })
    const res = await addTransaction(payload)
    this.setData({ saving: false })
    if (res.retCode !== 0) return
    setLastPref(pref)
    setLastBillId(payload.billId)
    wx.showToast({ title: '已保存' })
    if (again) {
      const form = this.selectComponent('#form') as any
      if (form && form.resetForAgain) form.resetForAgain()
      return
    }
    wx.navigateTo({ url: `/pages/bill-detail/index?id=${payload.billId}` })
  }
})
