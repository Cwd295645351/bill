import { addTransaction, getBillDetail, getBillList } from '../../apis/index'
import { guardPage } from '../../utils/auth'
import { getLastBillId, setBillDict, setLastBillId, setLastPref } from '../../utils/storage'
import { hideSaveLoading, showSaveLoading, uploadPendingPhotos } from '../../utils/upload-photos'

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
    const { payload, pref, photos } = e.detail
    this.setData({ saving: true })
    const form = this.selectComponent('#form') as any
    const list = Array.isArray(photos) ? photos : []

    try {
      if (list.length) {
        const serverIds = await uploadPendingPhotos(payload.billId, list, (ids) => {
          if (form && form.setPhotoServerIds) form.setPhotoServerIds(ids)
        })
        if (!serverIds) {
          this.setData({ saving: false })
          return
        }
        showSaveLoading('保存中')
        const body = { ...payload, imageIds: serverIds }
        const res = await addTransaction(body)
        if (res.retCode !== 0) return
      } else {
        showSaveLoading('保存中')
        const res = await addTransaction(payload)
        if (res.retCode !== 0) return
      }
      setLastPref(pref)
      setLastBillId(payload.billId)
      hideSaveLoading()
      wx.showToast({ title: '已保存' })
      wx.navigateTo({ url: `/pages/bill-detail/index?id=${payload.billId}` })
    } finally {
      hideSaveLoading()
      this.setData({ saving: false })
    }
  }
})
