import axios from 'axios'

const REFRESHING_TOKEN = '/api/commonrefreshToken' // 刷新token
const LOGOUT = '/api/common/logout' // 退出登录

const instance = axios.create()

// 刷新token
export const refreshToken = (refreshToken) => {
  return instance.post(refreshToken, { refreshToken: REFRESHING_TOKEN })
}

// 退出登录
export const logout = () => {
  return instance.post(LOGOUT)
}
