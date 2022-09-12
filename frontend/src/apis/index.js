import axios from 'axios'
import getEnv from '@/utils/getEnv'

const REFRESHING_TOKEN = '/api/commonrefreshToken' // 刷新token
const LOGOUT = '/api/common/logout' // 退出登录

const env = getEnv()

const instance = axios.create({
  baseURL: env.baseURL
})

// 刷新token
export const refreshToken = (refreshToken) => {
  return instance.post(refreshToken, { refreshToken: REFRESHING_TOKEN })
}

// 退出登录
export const logout = () => {
  return instance.post(LOGOUT)
}
