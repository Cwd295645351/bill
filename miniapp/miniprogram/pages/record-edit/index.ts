import { deleteTransaction, editTransaction, getBillDetail } from '../../apis/index'
import { guardPage } from '../../utils/auth'
import { toDayText } from '../../utils/date'
import { getEditingRecord, getUser, setBillDict, setLastPref } from '../../utils/storage'
import { hideSaveLoading, showSaveLoading, uploadPendingPhotos } from '../../utils/upload-photos'

Page({
  data: {
    billId: '',
    bill: null as any,
    initial: null as any,
    saving: false
  },

  onLoad(query: Record<string, string>) {
    const record = getEditingRecord()
    const billId = query.billId || (record && record.billId) || ''
    const dateText = record ? toDayText(record.date) : ''
    const initial = record ? Object.assign({}, record, { dateText }) : null
    this.setData({ billId, initial })
  },

  async onShow() {
    const ok = await guardPage()
    if (!ok) return
    if (!this.data.initial) {
      wx.showToast({ title: '记录不存在', icon: 'none' })
      setTimeout(() => wx.navigateBack(), 600)
      return
    }
    const me = getUser()
    if (!me || String(this.data.initial.userId) !== String(me.userId)) {
      wx.showToast({ title: '只能编辑自己记的账单', icon: 'none' })
      setTimeout(() => wx.navigateBack(), 600)
      return
    }
    if (this.data.bill) return
    const res = await getBillDetail(this.data.billId)
    if (res.retCode !== 0 || !res.data) return
    setBillDict(this.data.billId, res.data)
    this.setData({ bill: res.data })
  },

  /** 只在用户点保存且接口成功后返回。失败或未保存离开都不改原照片与字段。 */
  async onSubmit(e: WechatMiniprogram.CustomEvent) {
    if (this.data.saving) return
    const { payload, pref, photos } = e.detail
    this.setData({ saving: true })
    const form = this.selectComponent('#form') as any
    const list = Array.isArray(photos) ? photos : []

    try {
      const serverIds = await uploadPendingPhotos(payload.billId, list, (ids) => {
        if (form && form.setPhotoServerIds) form.setPhotoServerIds(ids)
      })
      if (serverIds == null) {
        this.setData({ saving: false })
        return
      }

      const existingIds =
        form && form.data && Array.isArray(form.data.images)
          ? form.data.images.map((img: any) => img.id)
          : []
      showSaveLoading('保存中')
      const res = await editTransaction({
        ...payload,
        imageIds: existingIds.concat(serverIds)
      })
      if (res.retCode !== 0) return
      setLastPref(pref)
      hideSaveLoading()
      wx.showToast({ title: '已保存' })
      setTimeout(() => wx.navigateBack(), 400)
    } finally {
      hideSaveLoading()
      this.setData({ saving: false })
    }
  },

  onDelete(e: WechatMiniprogram.CustomEvent) {
    const id = e.detail.id
    wx.showModal({
      title: '确定删除吗？',
      content: '删除后无法恢复',
      success: async (res) => {
        if (!res.confirm) return
        wx.showLoading({ title: '删除中', mask: true })
        const ret = await deleteTransaction(id)
        wx.hideLoading()
        if (ret.retCode === 0) {
          wx.showToast({ title: '已删除' })
          setTimeout(() => wx.navigateBack(), 400)
        }
      }
    })
  }
})
