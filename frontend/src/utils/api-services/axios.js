import axios from 'axios'
import dayjs from 'dayjs'
import { Message } from '@/utils/resetMessage'
import * as dasTools from '@/projects/Common/utils/das.tool'
import { getTokenByRefreshToken } from '@/projects/Common/api/dasFrame.api'

import { ref } from '@vue/reactivity'

import { watch } from '@vue-reactivity/watch'

const instance = axios.create()

let REFRESHING_TOKEN = false // 正在刷新token
const refreshTokenTime = ref('') // 新token更新时间

// 更新token并重新请求
function reFreshTokenThenRequest() {
  REFRESHING_TOKEN = true
  return new Promise((resolve, reject) => {
    getTokenByRefreshToken()
      .then((r) => {
        if (r.data.retCode === 0) {
          // 更新用户信息和过期时间
          dasTools.refreshUserInfo(r.data.data)
          console.log(r.data.data)
          dasTools.refreshExpireStamp(r.data.data.expiresIn)

          refreshTokenTime.value = new Date().getTime()

          // 重新发送当前请求
        } else {
          Message.error(r.data.message)
          setTimeout(() => {
            dasTools.logout()
          }, 3000)
        }
        resolve()
      })
      .catch((err) => {
        console.error(err)
        Message.warning('自动更新用户登录信息失败，请重新登录')
        setTimeout(() => {
          dasTools.logout()
        }, 3000)
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
  const language = 'zh-CN'

  config.headers.utcOffset = Number(dayjs().format('Z').replace(':00', ''))
  config.headers['Accept-Language'] = language
  if (
    config.url === 'http://192.168.100.154:8088/form/dataTemplate/v1/listJson' ||
    config.url === 'http://192.168.100.154:8088/form/dataTemplate/v1/getBpmDataTemplateInfo?alias=efe54bf8_equipmentReport&needDisplayFileds=false'
  ) {
    return config
  } else {
    const userInfo = dasTools.getUserInfo()
    const authorization = userInfo ? `${userInfo.tokenType} ${userInfo.accessToken}` : ''
    config.headers.Authorization = authorization
    config.headers['isClient'] = Number(dasTools.checkIsClient())
    if (!config.headers['projectId']) config.headers['projectId'] = dasTools.getClientSelected().id || ''
    return config
  }
}

export default instance
