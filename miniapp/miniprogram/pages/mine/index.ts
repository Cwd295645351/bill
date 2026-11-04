import { joinBill, updateProfile, changePassword, uploadAvatar, getLoginConfig } from '../../apis/index'
import { ensureLogin } from '../../utils/auth'
import { clearManualLogout, getManualLogout, getUser, patchUser, setManualLogout } from '../../utils/storage'
import { encryptPassword } from '../../utils/rsa'
import { showTip } from '../../utils/tip'

Page({
  data: {
    loggedOut: false,
    nickName: '',
    avatarText: '我',
    avatarUrl: '',
    sheetAvatarUrl: '',
    pendingAvatarPath: '',
    incomes: '0.00',
    expenses: '0.00',
    profileVisible: false,
    profileTab: 'info',
    editNick: '',
    oldPassword: '',
    newPassword: '',
    confirmPassword: '',
    savingInfo: false,
    savingPwd: false
  },

  onShow() {
    if (getManualLogout() || !getUser()) {
      this.setData({ loggedOut: true, avatarUrl: '' })
      return
    }
    this.renderUser()
    ensureLogin().then((status) => {
      if (status === 'ok') this.renderUser()
    })
  },

  renderUser() {
    const user = getUser()
    if (!user) {
      this.setData({ loggedOut: true, avatarUrl: '' })
      return
    }
    const name = user.nickName || '未命名'
    this.setData({
      loggedOut: false,
      nickName: name,
      avatarText: name.slice(0, 1),
      avatarUrl: user.avatarUrl || '',
      incomes: Number(user.incomes || 0).toFixed(2),
      expenses: Number(user.expenses || 0).toFixed(2)
    })
  },

  onOpenProfile() {
    if (this.data.loggedOut) {
      showTip('请先登录')
      return
    }
    this.setData({
      profileVisible: true,
      profileTab: 'info',
      editNick: this.data.nickName || '',
      sheetAvatarUrl: this.data.avatarUrl || '',
      pendingAvatarPath: '',
      oldPassword: '',
      newPassword: '',
      confirmPassword: ''
    })
  },

  onCloseProfile() {
    this.setData({ profileVisible: false, pendingAvatarPath: '' })
  },

  onProfileTabChange(e: any) {
    const name = (e && e.detail && (e.detail.name || e.detail)) || 'info'
    this.setData({ profileTab: String(name) })
  },

  onNickChange(e: any) {
    this.setData({ editNick: (e.detail || '').toString() })
  },
  onOldPwdChange(e: any) {
    this.setData({ oldPassword: (e.detail || '').toString() })
  },
  onNewPwdChange(e: any) {
    this.setData({ newPassword: (e.detail || '').toString() })
  },
  onConfirmPwdChange(e: any) {
    this.setData({ confirmPassword: (e.detail || '').toString() })
  },

  async onPickPendingAvatar() {
    if (this.data.loggedOut) {
      showTip('请先登录')
      return
    }
    try {
      const choose = await new Promise<WechatMiniprogram.ChooseImageSuccessCallbackResult>((resolve, reject) => {
        wx.chooseImage({
          count: 1,
          sizeType: ['compressed'],
          sourceType: ['album', 'camera'],
          success: resolve,
          fail: reject
        })
      })
      const path = choose.tempFilePaths && choose.tempFilePaths[0]
      if (!path) return
      this.setData({ sheetAvatarUrl: path, pendingAvatarPath: path })
    } catch {
      /* cancel */
    }
  },

  /** 顶部头像快捷更换：选图后立刻上传 */
  async onChangeAvatar() {
    if (this.data.loggedOut) {
      showTip('请先登录')
      return
    }
    try {
      const choose = await new Promise<WechatMiniprogram.ChooseImageSuccessCallbackResult>((resolve, reject) => {
        wx.chooseImage({
          count: 1,
          sizeType: ['compressed'],
          sourceType: ['album', 'camera'],
          success: resolve,
          fail: reject
        })
      })
      const path = choose.tempFilePaths && choose.tempFilePaths[0]
      if (!path) return
      this.setData({ sheetAvatarUrl: path })
      wx.showLoading({ title: '上传中' })
      const ret = await uploadAvatar(path)
      wx.hideLoading()
      if (ret.retCode === 0) {
        const data = ret.data || {}
        patchUser({
          nickName: data.nickName != null ? data.nickName : undefined,
          avatarUrl: data.avatarUrl != null ? data.avatarUrl : undefined,
          incomes: data.incomes != null ? Number(data.incomes) : undefined,
          expenses: data.expenses != null ? Number(data.expenses) : undefined
        } as any)
        this.renderUser()
        this.setData({
          sheetAvatarUrl: data.avatarUrl != null ? data.avatarUrl : path,
          pendingAvatarPath: ''
        })
        showTip('头像已更新')
      }
    } catch {
      wx.hideLoading()
    }
  },

  async onSaveProfileInfo() {
    if (this.data.savingInfo) return
    const nick = (this.data.editNick || '').trim()
    const nickReg = /^[\u4E00-\u9FA5A-Za-z0-9_]{1,20}$/
    if (!nickReg.test(nick)) {
      showTip('昵称格式不正确')
      return
    }
    const nickChanged = nick !== this.data.nickName
    const pending = this.data.pendingAvatarPath
    if (!pending && !nickChanged) {
      showTip('没有需要保存的变更')
      return
    }

    this.setData({ savingInfo: true })
    try {
      if (pending) {
        const ret = await uploadAvatar(pending)
        if (ret.retCode !== 0) return
        const data = ret.data || {}
        patchUser({
          nickName: data.nickName != null ? data.nickName : undefined,
          avatarUrl: data.avatarUrl != null ? data.avatarUrl : undefined,
          incomes: data.incomes != null ? Number(data.incomes) : undefined,
          expenses: data.expenses != null ? Number(data.expenses) : undefined
        } as any)
        this.renderUser()
        this.setData({
          sheetAvatarUrl: data.avatarUrl != null ? data.avatarUrl : pending,
          pendingAvatarPath: ''
        })
      }

      if (nickChanged) {
        const ret = await updateProfile(nick)
        if (ret.retCode !== 0) return
        const data = ret.data || {}
        patchUser({
          nickName: data.nickName || nick,
          avatarUrl: data.avatarUrl != null ? data.avatarUrl : undefined,
          incomes: data.incomes != null ? Number(data.incomes) : undefined,
          expenses: data.expenses != null ? Number(data.expenses) : undefined
        } as any)
        this.renderUser()
      }

      showTip('个人资料已更新')
    } finally {
      this.setData({ savingInfo: false })
    }
  },

  async onSavePassword() {
    if (this.data.savingPwd) return
    const oldPwd = (this.data.oldPassword || '').trim()
    const newPwd = (this.data.newPassword || '').trim()
    const confirmPwd = (this.data.confirmPassword || '').trim()
    if (!oldPwd || !newPwd) {
      showTip('请填写旧密码和新密码')
      return
    }
    if (newPwd !== confirmPwd) {
      showTip('两次新密码不一致')
      return
    }
    if (newPwd.length < 8 || !/[a-z]/.test(newPwd) || !/[A-Z]/.test(newPwd) || !/\d/.test(newPwd)) {
      showTip('新密码至少8位且含大小写与数字')
      return
    }

    this.setData({ savingPwd: true })
    try {
      const cfg = await getLoginConfig()
      if (cfg.retCode !== 0 || !cfg.data?.publicKey) {
        showTip(cfg.message || '获取加密配置失败')
        return
      }
      const retPwd = await changePassword(
        encryptPassword(cfg.data.publicKey, oldPwd),
        encryptPassword(cfg.data.publicKey, newPwd)
      )
      if (retPwd.retCode !== 0) return
      this.setData({ profileVisible: false })
      showTip('密码已更新，请重新登录')
      setManualLogout()
      this.setData({ loggedOut: true, avatarUrl: '' })
    } finally {
      this.setData({ savingPwd: false })
    }
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
        this.setData({ loggedOut: true, avatarUrl: '' })
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