import { ensureLogin, getManualLogout } from './utils/auth'

function buildRedirect(options: WechatMiniprogram.App.LaunchShowOption) {
  const path = options.path ? `/${options.path}` : '/pages/bills/index'
  const query = options.query || {}
  const qs = Object.keys(query)
    .map((key) => `${key}=${encodeURIComponent(query[key] || '')}`)
    .join('&')
  return qs ? `${path}?${qs}` : path
}

/** 有新版本时强制更新：旧版本的记账请求会被服务端拒绝 */
function forceUpdate() {
  if (!wx.canIUse('getUpdateManager')) return
  const manager = wx.getUpdateManager()
  manager.onUpdateReady(() => {
    wx.showModal({
      title: '发现新版本',
      content: '新版本已准备好，请重启使用',
      showCancel: false,
      success: () => manager.applyUpdate()
    })
  })
  manager.onUpdateFailed(() => {
    wx.showModal({
      title: '更新失败',
      content: '新版本下载失败，请删除小程序后重新打开',
      showCancel: false
    })
  })
}

App({
  onLaunch(options) {
    forceUpdate()
    if (getManualLogout()) return
    const redirect = buildRedirect(options)
    ensureLogin().then((status) => {
      if (status !== 'bind') return
      if (options.path === 'pages/bind/index') return
      wx.reLaunch({
        url: `/pages/bind/index?redirect=${encodeURIComponent(redirect)}`
      })
    })
  }
})
