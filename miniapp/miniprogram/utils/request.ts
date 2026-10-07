import { ensureLogin } from './auth'
import { http, HttpOptions } from './http'
import { getUser, isExpired } from './storage'
import { showTip } from './tip'

export interface ApiBody<T = any> {
  retCode: number
  message: string
  data: T
}

export interface RequestOptions extends HttpOptions {
  /** 默认携带登录头。登录、绑定接口传 false */
  auth?: boolean
  /** 为 true 时业务错误不弹 toast，由页面自己处理 */
  silent?: boolean
  retried?: boolean
}

let redirectingBind = false

function authHeader() {
  const user = getUser()
  if (!user) return {}
  return {
    Authorization: `bearer ${user.accessToken}`,
    userId: user.userId,
    nickName: encodeURIComponent(user.nickName || '')
  }
}

function currentRedirect() {
  const pages = getCurrentPages()
  const cur = pages[pages.length - 1] as any
  if (!cur) return '/pages/bills/index'
  const opts = cur.options || {}
  const qs = Object.keys(opts)
    .map((key) => `${key}=${encodeURIComponent(opts[key] || '')}`)
    .join('&')
  return `/${cur.route}${qs ? '?' + qs : ''}`
}

function goBind() {
  if (redirectingBind) return
  redirectingBind = true
  const redirect = encodeURIComponent(currentRedirect())
  wx.reLaunch({
    url: `/pages/bind/index?redirect=${redirect}`,
    complete: () => {
      redirectingBind = false
    }
  })
}

/**
 * 业务请求。令牌过期或 401 时静默 wx.login 换新令牌，并只重放一次。
 * 多个请求同时过期时共用同一次登录。
 */
export async function request<T = any>(options: RequestOptions): Promise<ApiBody<T>> {
  const auth = options.auth !== false
  if (auth && isExpired()) {
    const status = await ensureLogin()
    if (status === 'bind') {
      goBind()
      return { retCode: 401, message: '请先绑定账号', data: null as T }
    }
    if (status !== 'ok') {
      showTip('登录已失效')
      return { retCode: 401, message: '登录已失效', data: null as T }
    }
  }

  const header = Object.assign({}, auth ? authHeader() : {}, options.header || {})
  let resp
  try {
    resp = await http<ApiBody<T>>({
      url: options.url,
      method: options.method,
      data: options.data,
      header
    })
  } catch (err) {
    if (!options.silent) showTip('网络异常')
    return { retCode: -1, message: '网络异常', data: null as T }
  }

  if (resp.statusCode === 401 && auth && !options.retried) {
    const status = await ensureLogin()
    if (status === 'ok') {
      return request<T>(Object.assign({}, options, { retried: true }))
    }
    if (status === 'bind') goBind()
    return { retCode: 401, message: '请重新登录', data: null as T }
  }

  const body = resp.data || { retCode: -1, message: '响应为空', data: null as T }
  if (body.retCode !== 0 && !options.silent && resp.statusCode !== 401) {
    showTip(body.message || '请求失败')
  }
  return body
}
