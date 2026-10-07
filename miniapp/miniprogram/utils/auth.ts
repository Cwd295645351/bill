import { http } from './http'
import {
  clearBindTicket,
  getManualLogout,
  getUser,
  isExpired,
  saveSession,
  setBindTicket
} from './storage'

export { getManualLogout } from './storage'

export type LoginStatus = 'ok' | 'bind' | 'fail'

const TABS = ['/pages/bills/index', '/pages/record-add/index', '/pages/mine/index']

let pending: Promise<LoginStatus> | null = null

/** 并发的 401 和启动登录合并成一次 wx.login */
export function ensureLogin(): Promise<LoginStatus> {
  if (getManualLogout()) return Promise.resolve('fail')
  if (pending) return pending
  pending = loginWithCode().finally(() => {
    pending = null
  })
  return pending
}

function loginWithCode(): Promise<LoginStatus> {
  return new Promise((resolve) => {
    wx.login({
      success: (res) => {
        if (!res.code) {
          resolve('fail')
          return
        }
        http({ url: '/api/v1/common/wxLogin', method: 'POST', data: { code: res.code } })
          .then((resp) => {
            const body = resp.data || {}
            if (body.retCode !== 0 || !body.data) {
              resolve('fail')
              return
            }
            if (body.data.needBind) {
              setBindTicket(body.data.bindTicket)
              resolve('bind')
              return
            }
            saveSession(body.data)
            clearBindTicket()
            resolve('ok')
          })
          .catch(() => resolve('fail'))
      },
      fail: () => resolve('fail')
    })
  })
}

/** 绑定成功或重新进入后的跳转。tab 页不能带 query */
export function openAfterLogin(redirect?: string) {
  const url = redirect || '/pages/bills/index'
  const path = url.split('?')[0]
  if (TABS.indexOf(path) >= 0) {
    wx.switchTab({ url: path })
  } else {
    wx.reLaunch({ url })
  }
}

/** 页面进入时保证已登录。主动退出则回到「我的」 */
export async function guardPage(): Promise<boolean> {
  if (getManualLogout()) {
    wx.switchTab({ url: '/pages/mine/index' })
    return false
  }
  if (!getUser() || isExpired()) {
    const status = await ensureLogin()
    if (status === 'bind') {
      const pages = getCurrentPages()
      const cur = pages[pages.length - 1]
      if (!cur || cur.route !== 'pages/bind/index') {
        wx.reLaunch({ url: '/pages/bind/index' })
      }
      return false
    }
    if (status !== 'ok') {
      wx.showToast({ title: '登录失败，请稍后重试', icon: 'none' })
      return false
    }
  }
  return true
}
