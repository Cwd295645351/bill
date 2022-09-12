import axios from 'axios'
import { Message } from 'element-ui'
import { refreshToken } from '@/apis'
import * as tools from '../tools'
import { ref } from '@vue/reactivity'
import { watch } from '@vue-reactivity/watch'

const instance = axios.create()

const EXCLUDE_URL = ['/getLoginConfig', '/login'] // 无需进行请求拦截的接口
let REFRESHING_TOKEN = false // 正在刷新token
const refreshTokenTime = ref('') // 新token更新时间

// 更新token并重新请求
function reFreshTokenThenRequest() {
  REFRESHING_TOKEN = true
  return new Promise((resolve, reject) => {
    refreshToken()
      .then((r) => {
        const res = r.data
        if (res.retCode === 0) {
          // 更新用户信息和过期时间
          tools.refreshUserInfo(res.data)
          console.log(res.data)
          tools.refreshExpireStamp(res.data.expiresIn)
          refreshTokenTime.value = new Date().getTime()

          // 重新发送当前请求
        } else {
          Message.error(res.message)
          setTimeout(() => {
            tools.logoutUser()
          }, 1000)
        }
        resolve()
      })
      .catch((err) => {
        console.error(err)
        Message.warning('自动更新用户登录信息失败，请重新登录')
        setTimeout(() => {
          tools.logoutUser()
        }, 1000)
        reject()
      })
      .finally(() => {
        REFRESHING_TOKEN = false
      })
  })
}

// 请求拦截
instance.interceptors.request.use(
  async (config) => {
    if (EXCLUDE_URL.includes(config.url)) return config
    if (REFRESHING_TOKEN) {
      // 正在刷新token，等待新token返回
      return new Promise((resolve) => {
        const stopWatch = watch(refreshTokenTime, (newValue) => {
          console.log('newToken已更新')
          resolve(setRequestConfig(config))
        })
      })
    } else {
      // 判断当前时间是否过期，若过期则刷新token
      const expiresAt = Number(sessionStorage.getItem('expiresAt'))
      const nowMs = new Date().getTime()
      if (nowMs >= expiresAt) {
        try {
          console.log('等待token')
          await reFreshTokenThenRequest()
          console.log('token已返回')
        } catch (err) {
          console.error(err)
        }
      }

      return setRequestConfig(config)
    }
  },
  (err) => {
    return Promise.reject(err)
  }
)

// 设置请求拦截
const setRequestConfig = (config) => {
  const userInfo = tools.getUserInfo()
  const authorization = userInfo ? `bearer ${userInfo.accessToken}` : ''
  config.headers.Authorization = authorization
  return config
}

export default instance
