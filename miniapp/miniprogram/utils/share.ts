/** 打开右上角「转发」「分享到朋友圈」 */
export function enableAppShare() {
  wx.showShareMenu({ menus: ['shareAppMessage', 'shareTimeline'] })
}

/** 转发小程序：只进账本列表，不带邀请码 */
export function appShareMessage() {
  return {
    title: '记账',
    path: '/pages/bills/index'
  }
}

/**
 * 分享到朋友圈：路径只能是当前页。
 * query 置空，避免把邀请码、账本 id 等参数带出去。
 */
export function appShareTimeline() {
  return {
    title: '记账',
    query: ''
  }
}
