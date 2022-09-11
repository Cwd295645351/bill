import { logout } from '@/apis'
const USER_INFO_KEY = 'userInfo'
const EXPIRE_AT = 'expiresAt'
import mvue from '../main'

// 获取完整登录信息
export function getUserInfo() {
  const userInfoStr = window.sessionStorage.getItem(USER_INFO_KEY)
  const userInfo = userInfoStr && JSON.parse(userInfoStr)
  return userInfo || null
}

// 刷新需要主动刷新token时间戳
export function refreshExpireStamp(secondsExpiresIn) {
  if (secondsExpiresIn > 0) {
    const MS_ONE_SECOND = 1000
    const nextStamp = new Date().getTime() + secondsExpiresIn * MS_ONE_SECOND
    sessionStorage.setItem(EXPIRE_AT, nextStamp)
  }
}

// 刷新用户信息
export function refreshUserInfo(refreshInfo) {
  let userInfo = getUserInfo()
  userInfo = {
    ...userInfo,
    ...refreshInfo
  }
  console.log('刷新userinfo刷新userinfo刷新userinfo')
  window.sessionStorage.setItem(USER_INFO_KEY, JSON.stringify(userInfo))
}

// 退出登录
export function logoutUser() {
  window.sessionStorage.removeItem(USER_INFO_KEY)
  window.sessionStorage.removeItem(EXPIRE_AT)
  logout().finally(() => {
    sessionStorage.clear()
    mvue.$router.push('/login')
  })
  // window.location.reload()
}
