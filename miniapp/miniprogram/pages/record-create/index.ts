import { addTransaction, getBillDetail } from '../../apis/index'
import { guardPage } from '../../utils/auth'
import { setBillDict, setLastBillId, setLastPref } from '../../utils/storage'
import { hideSaveLoading, showSaveLoading, uploadPendingPhotos } from '../../utils/upload-photos'

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
        const res = await addTransaction({ ...payload, imageIds: serverIds })
        if (res.retCode !== 0) return
      } else {
        showSaveLoading('保存中')
        const res = await addTransaction(payload)
        if (res.retCode !== 0) return
      }
      setLastPref(pref)
      hideSaveLoading()
      wx.showToast({ title: '已保存' })
      wx.navigateBack()
    } finally {
      hideSaveLoading()
      this.setData({ saving: false })
    }
  }
})
