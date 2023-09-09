import axios from 'axios'
import { getConfig } from '@/utils/config'
import { getUserInfo } from '@/utils/common-info'

const config = getConfig()

const version = config.version

const REFRESHING_TOKEN = `/api/${version}/common/refreshToken` // 刷新token
const LOGOUT = `/api/${version}/common/logout` // 退出登录

const instance = axios.create()

instance.interceptors.request.use(
  (config: any) => {
    const userInfo = getUserInfo()
    const authorization = userInfo ? `bearer ${userInfo.accessToken}` : ''
    if (!config.headers) config.headers = {}
    config.headers.Authorization = authorization
    return config
  },
  (err) => {
    return Promise.reject(err)
  },
)

// 刷新token
export const refreshToken = (refreshToken: string) => {
  instance.defaults.baseURL = getConfig().baseURL
  return instance.put(REFRESHING_TOKEN, { refreshToken })
}

// 退出登录
export const logout = () => {
  instance.defaults.baseURL = getConfig().baseURL
  return instance.post(LOGOUT)
}
