/** 短文案用 toast，长文案用弹窗，避免提示被截断 */
export function showTip(message: string) {
  const text = message || '请求失败'
  if (text.length > 14) {
    wx.showModal({ title: '提示', content: text, showCancel: false })
    return
  }
  wx.showToast({ title: text, icon: 'none' })
}
