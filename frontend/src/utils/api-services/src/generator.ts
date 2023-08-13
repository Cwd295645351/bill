import axiosInstance from './axios'
import curringHttp from './curring'
import { logoutUser } from '@/utils/common-info'
import { AxiosResponse } from 'axios'

import type { ConfigFn } from '../type'


/** 失败回调 */
const onError = (error: any) => {
  if (error.response) {
    // http状态码非2XX
    const status = error.response.status
    const messageMap: any = {
      400: '参数校验错误',
      401: '用户认证失败，请重新登陆',
      404: '接口地址未找到',
      500: '服务器内部错误',
    }
    const message = error.response.message || error.response.data?.message
    ElMessage.error(message || messageMap[status] || '请求失败')
    if (status === 401) {
      logoutUser()
    }
  } else if (error.request) {
    // 请求已发出，但是没有响应，视为断网
    ElMessage.error('网络异常，请检查您的网络情况')
  } else {
    // 取消请求或请求配置异常
    ElMessage.error('请求被取消')
  }
  // 最后返回错误，阻塞代码，并可供业务自行处理
  return Promise.reject(error.response || error)
}

/** 请求生成器 */
const generator = (url: string, customConfig?: ConfigFn) => {
  return curringHttp(axiosInstance, (config) => {
    config.baseURL = config.baseURL + url
    config.onError = onError
    return customConfig?.(config) || config
  })
}

export default generator
