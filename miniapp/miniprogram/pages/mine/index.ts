import { joinBill } from '../../apis/index'
import { ensureLogin } from '../../utils/auth'
import { clearManualLogout, getManualLogout, getUser, setManualLogout } from '../../utils/storage'
import { showTip } from '../../utils/tip'

Page({
  data: {
    loggedOut: false,
    nickName: '',
    avatarText: '我',
    incomes: '0.00',
    expenses: '0.00'
  },

  onShow() {
    if (getManualLogout() || !getUser()) {
      this.setData({ loggedOut: true })
      return
    }
    this.renderUser()
    // 静默换票，刷新总收入、总支出
    ensureLogin().then((status) => {
      if (status === 'ok') this.renderUser()
    })
  },

  renderUser() {
    const user = getUser()
    if (!user) {
      this.setData({ loggedOut: true })
      return
    }
    const name = user.nickName || '未命名'
    this.setData({
      loggedOut: false,
      nickName: name,
      avatarText: name.slice(0, 1),
      incomes: Number(user.incomes || 0).toFixed(2),
      expenses: Number(user.expenses || 0).toFixed(2)
    })
  },

  onJoin() {
    if (this.data.loggedOut) {
        showTip('请先登录')
      return
    }
    wx.showModal({
      title: '加入账本',
      editable: true,
      placeholderText: '请输入邀请码',
      success: async (res) => {
        if (!res.confirm) return
        const code = (res.content || '').trim()
        if (!code) {
          showTip('邀请码不能为空')
          return
        }
        const ret = await joinBill(code)
        const message = ret.message && ret.message.indexOf('失效') >= 0 ? '邀请已失效，请让创建者重新分享' : ret.message
        showTip(ret.retCode === 0 ? '已加入账本' : message || '加入失败')
      }
    })
  },

  onLogout() {
    wx.showModal({
      title: '退出登录',
      content: '退出后需要手动重新进入。微信绑定仍会保留。',
      success: (res) => {
        if (!res.confirm) return
        setManualLogout()
        this.setData({ loggedOut: true })
      }
    })
  },

  async onRelogin() {
    clearManualLogout()
    wx.showLoading({ title: '登录中' })
    const status = await ensureLogin()
    wx.hideLoading()
    if (status === 'ok') {
      this.renderUser()
      return
    }
    if (status === 'bind') {
      wx.reLaunch({ url: '/pages/bind/index' })
      return
    }
    showTip('登录失败')
  }
})
