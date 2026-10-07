import { createBill, deleteBill, getBillList } from '../../apis/index'
import { guardPage } from '../../utils/auth'
import { getUser, setLastBillId } from '../../utils/storage'

const NAME_REG = /^[\u4E00-\u9FA5A-Za-z0-9_]{3,10}$/

Page({
  data: {
    bills: [] as any[],
    loading: true,
    userId: ''
  },

  async onShow() {
    const ok = await guardPage()
    if (!ok) return
    const user = getUser()
    this.setData({ userId: user ? user.userId : '' })
    this.load()
  },

  async load() {
    this.setData({ loading: true })
    const res = await getBillList()
    const bills = res.retCode === 0 && Array.isArray(res.data) ? res.data : []
    this.setData({ bills, loading: false })
  },

  onOpen(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id
    setLastBillId(id)
    wx.navigateTo({ url: `/pages/bill-detail/index?id=${id}` })
  },

  onCreate() {
    wx.showModal({
      title: '新建账本',
      editable: true,
      placeholderText: '3-10个字，中文、字母或数字',
      success: async (res) => {
        if (!res.confirm) return
        const name = (res.content || '').trim()
        if (!NAME_REG.test(name)) {
          wx.showModal({ title: '提示', content: '名称需为 3-10 位中文、字母或数字', showCancel: false })
          return
        }
        const ret = await createBill(name)
        if (ret.retCode === 0) {
          wx.showToast({ title: '已创建' })
          this.load()
        }
      }
    })
  },

  onDelete(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id
    wx.showModal({
      title: '确定删除吗？',
      content: '删除后账本相关数据将无法恢复',
      success: async (res) => {
        if (!res.confirm) return
        const ret = await deleteBill(id)
        if (ret.retCode === 0) {
          wx.showToast({ title: '已删除' })
          this.load()
        }
      }
    })
  }
})
