import { getLoginConfig, wxBind } from '../../apis/index'
import { ensureLogin, openAfterLogin } from '../../utils/auth'
import { encryptPassword } from '../../utils/rsa'
import { showTip } from '../../utils/tip'
import { clearBindTicket, getBindTicket, getManualLogout, getUser, saveSession } from '../../utils/storage'

/** Vant Field 的 change 事件在默认配置下直接把字符串作为 detail */
function fieldText(detail: unknown): string {
  if (typeof detail === 'string') return detail
  const value = (detail as { value?: string }) && (detail as { value?: string }).value
  return value == null ? '' : String(value)
}

Page({
  data: {
    username: '',
    password: '',
    submitting: false,
    captchaVisible: false,
    captchaId: '',
    captchaX: 0,
    captchaReady: false
  },

  redirect: '',
  publicKey: '',

  onLoad(query: Record<string, string>) {
    this.redirect = query.redirect ? decodeURIComponent(query.redirect) : ''
  },

  async onShow() {
    if (getUser() && !getManualLogout()) {
      openAfterLogin(this.redirect)
      return
    }
    if (!getBindTicket()) {
      const status = await ensureLogin()
      if (status === 'ok') {
        openAfterLogin(this.redirect)
        return
      }
      if (status === 'fail') {
        showTip('微信登录失败，请检查网络与小程序配置')
      }
    }
    const cfg = await getLoginConfig()
    if (cfg.retCode === 0 && cfg.data) this.publicKey = cfg.data.publicKey
  },

  onUsername(e: WechatMiniprogram.CustomEvent) {
    this.setData({ username: fieldText(e.detail) })
  },

  onPassword(e: WechatMiniprogram.CustomEvent) {
    this.setData({ password: fieldText(e.detail) })
  },

  onCaptchaUpdate(e: WechatMiniprogram.CustomEvent) {
    const d = (e.detail || {}) as { captchaId?: string; captchaX?: number; ready?: boolean }
    const captchaId = d.captchaId || ''
    const captchaX = typeof d.captchaX === 'number' ? d.captchaX : 0
    const captchaReady = !!d.ready
    this.setData({ captchaId, captchaX, captchaReady })
    if (captchaReady && this.data.captchaVisible && !this.data.submitting) {
      void this.doBind()
    }
  },

  onCaptchaClose() {
    this.setData({
      captchaVisible: false,
      captchaId: '',
      captchaX: 0,
      captchaReady: false
    })
  },

  async onSubmit() {
    const username = (this.data.username || '').trim()
    const password = this.data.password || ''
    if (!/^\w{3,20}$/.test(username)) {
      showTip('用户名为3-20位字母、数字或下划线')
      return
    }
    if (!password) {
      showTip('请输入密码')
      return
    }
    if (!this.publicKey) {
      showTip('登录公钥获取失败')
      return
    }
    const ticket = getBindTicket()
    if (!ticket) {
      showTip('绑定凭证已失效，请重新进入')
      return
    }
    this.setData({
      captchaVisible: true,
      captchaId: '',
      captchaX: 0,
      captchaReady: false
    })
  },

  async doBind() {
    if (this.data.submitting) return
    if (!this.data.captchaReady || !this.data.captchaId) return
    const username = (this.data.username || '').trim()
    const password = this.data.password || ''
    const ticket = getBindTicket()
    if (!ticket) {
      showTip('绑定凭证已失效，请重新进入')
      this.onCaptchaClose()
      return
    }
    this.setData({ submitting: true })
    let cipher = ''
    try {
      cipher = encryptPassword(this.publicKey, password)
    } catch (err) {
      this.setData({ submitting: false })
      showTip('密码加密失败')
      return
    }
    const res = await wxBind({
      bindTicket: ticket,
      username,
      password: cipher,
      captchaId: this.data.captchaId,
      captchaX: this.data.captchaX
    })
    this.setData({ submitting: false })
    if (res.retCode !== 0 || !res.data) {
      const message = res.message || '绑定失败'
      showTip(message)
      if (message.indexOf('凭证') >= 0) clearBindTicket()
      const slider = this.selectComponent('#slider') as any
      if (slider && typeof slider.reload === 'function') slider.reload()
      return
    }
    this.setData({ captchaVisible: false })
    saveSession(res.data)
    clearBindTicket()
    wx.showToast({ title: '绑定成功' })
    setTimeout(() => openAfterLogin(this.redirect), 400)
  }
})