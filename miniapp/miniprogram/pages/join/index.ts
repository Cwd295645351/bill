import { joinBill } from '../../apis/index'
import { ensureLogin } from '../../utils/auth'
import { getManualLogout, getUser, isExpired } from '../../utils/storage'

Page({
  prompted: false,
  data: {
    code: '',
    name: '共享账本',
    message: '',
    joined: false
  },

  onLoad(query: Record<string, string>) {
    this.setData({
      code: query.code ? decodeURIComponent(query.code) : '',
      name: query.name ? decodeURIComponent(query.name) : '共享账本'
    })
  },

  async onShow() {
    if (this.data.joined) return
    if (getManualLogout()) {
      wx.switchTab({ url: '/pages/mine/index' })
      return
    }
    const status = getUser() && !isExpired() ? 'ok' : await ensureLogin()
    if (status === 'bind') {
      const redirect = `/pages/join/index?code=${encodeURIComponent(this.data.code)}&name=${encodeURIComponent(this.data.name)}`
      wx.reLaunch({ url: `/pages/bind/index?redirect=${encodeURIComponent(redirect)}` })
      return
    }
    if (status !== 'ok') {
      this.setData({ message: '请先登录后再加入账本' })
      return
    }
    if (this.prompted) return
    this.prompted = true
    wx.showModal({
      title: '加入账本',
      content: `确认加入《${this.data.name}》？`,
      success: (res) => {
        if (res.confirm) this.doJoin()
        else this.setData({ message: '已取消。可再次点击下方按钮加入。' })
      }
    })
  },

  async doJoin() {
    if (!this.data.code) {
      this.setData({ message: '邀请码无效' })
      return
    }
    wx.showLoading({ title: '加入中' })
    const res = await joinBill(this.data.code)
    wx.hideLoading()
    if (res.retCode === 0) {
      this.setData({ joined: true, message: '已加入账本' })
      return
    }
    const raw = res.message || '加入失败'
    const message = raw.indexOf('失效') >= 0 ? '邀请已失效，请让创建者重新分享' : raw
    this.setData({ message })
  },

  goBills() {
    wx.switchTab({ url: '/pages/bills/index' })
  }
})
