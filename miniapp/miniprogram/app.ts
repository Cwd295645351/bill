import { ensureLogin, getManualLogout } from './utils/auth'

function buildRedirect(options: WechatMiniprogram.App.LaunchShowOption) {
  const path = options.path ? `/${options.path}` : '/pages/bills/index'
  const query = options.query || {}
  const qs = Object.keys(query)
    .map((key) => `${key}=${encodeURIComponent(query[key] || '')}`)
    .join('&')
  return qs ? `${path}?${qs}` : path
}

App({
  onLaunch(options) {
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
