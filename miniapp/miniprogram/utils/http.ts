import { getBaseURL } from '../config/env'

export interface HttpResult<T> {
  statusCode: number
  data: T
}

export interface HttpOptions {
  url: string
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  data?: any
  header?: Record<string, string>
}

/** 不带登录态的请求，供登录、绑定使用，避免和 401 重试互相调用 */
export function http<T = any>(options: HttpOptions): Promise<HttpResult<T>> {
  const method = options.method || 'GET'
  let url = options.url
  if (url.indexOf('http') !== 0) url = getBaseURL() + url
  // DELETE 的参数走 query，和现有 Koa 路由 ctx.query 对齐
  if (method === 'DELETE' && options.data) {
    const qs = Object.keys(options.data)
      .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(options.data[key])}`)
      .join('&')
    url += (url.indexOf('?') >= 0 ? '&' : '?') + qs
  }
  return new Promise((resolve, reject) => {
    wx.request({
      url,
      method,
      data: method === 'DELETE' ? undefined : options.data,
      header: Object.assign({ 'Content-Type': 'application/json' }, options.header || {}),
      success: (res) => {
        resolve({ statusCode: res.statusCode, data: res.data as T })
      },
      fail: (err) => reject(err)
    })
  })
}
