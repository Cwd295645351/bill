/**
 * 用小程序 wx.login 拿到的 code 换取 openid。
 * code 只能使用一次，session_key 不下发、不落库。
 */
const code2session = async (code) => {
  const appid = process.env.WX_APPID
  const secret = process.env.WX_SECRET
  if (!appid || !secret) return ['未配置微信小程序 WX_APPID / WX_SECRET', null]
  if (!code) return ['code不能为空', null]

  const query = [
    `appid=${encodeURIComponent(appid)}`,
    `secret=${encodeURIComponent(secret)}`,
    `js_code=${encodeURIComponent(code)}`,
    'grant_type=authorization_code'
  ].join('&')
  const url = `https://api.weixin.qq.com/sns/jscode2session?${query}`

  try {
    const resp = await fetch(url)
    const data = await resp.json()
    if (!data || data.errcode) {
      return [data?.errmsg || '微信登录失败', null]
    }
    if (!data.openid) return ['微信未返回 openid', null]
    return [null, { openid: data.openid, unionid: data.unionid || '' }]
  } catch (err) {
    console.error(err)
    return ['请求微信登录接口失败', null]
  }
}

module.exports = { code2session }
