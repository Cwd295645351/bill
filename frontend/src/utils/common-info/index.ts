import router from '@/router'
import { logout } from '@/apis'

import type { UserInfo, RefreshTokenInfo } from '@/types/user-info'

/** 用户信息 */
const USER_INFO_KEY = 'userInfo'
/** 过期时间 */
const EXPIRE_AT = 'expiresAt'

/** 获取完整登录信息 */
export function getUserInfo(): UserInfo {
  const userInfoStr = window.sessionStorage.getItem(USER_INFO_KEY) || ''
  const userInfo = JSON.parse(userInfoStr) as UserInfo
  return userInfo
}

/** 刷新需要主动刷新token时间戳 */
export function refreshExpireStamp(secondsExpiresIn: number) {
  if (secondsExpiresIn > 0) {
    const MS_ONE_SECOND = 1000
    const nextStamp = new Date().getTime() + secondsExpiresIn * MS_ONE_SECOND
    sessionStorage.setItem(EXPIRE_AT, nextStamp.toString())
  }
}

/** 刷新用户信息 */
export function refreshUserInfo(refreshInfo: RefreshTokenInfo) {
  let userInfo = getUserInfo()
  userInfo = {
    ...userInfo,
    ...refreshInfo,
  }
  console.log('刷新userinfo刷新userinfo刷新userinfo')
  window.sessionStorage.setItem(USER_INFO_KEY, JSON.stringify(userInfo))
}

/** 退出登录 */
export function logoutUser() {
  window.sessionStorage.removeItem(USER_INFO_KEY)
  window.sessionStorage.removeItem(EXPIRE_AT)
  logout().finally(() => {
    sessionStorage.clear()
    router.push('/login')
  })
}
