import { AxiosRequestConfig, AxiosInstance } from 'axios'
import { getConfig } from '../../config'
import type { Payload, ConfigFn, Method, RequestConfig, CurringRes } from '../type'

import axios from 'axios'

/** 根据 contentType 格式转化请求数据 */
const setContentTypeData = (config: AxiosRequestConfig, payloadConfig: Payload) => {
  const contentType = config.headers?.['Content-Type']
  if (contentType !== 'application/x-www-form-urlencoded' && contentType !== 'multipart/form-data') {
    return
  }
  const data = payloadConfig.data as Record<string, any>
  if (contentType === 'application/x-www-form-urlencoded') {
    if (data) {
      let str = ''
      for (const key in data) {
        str += `&${key}=${data[key]}`
      }
      payloadConfig.data = str.slice(1)
    }
  } else if (contentType === 'multipart/form-data') {
    if (data) {
      const formData = new FormData()
      for (const key in data) {
        formData.append(key, data[key])
      }
      payloadConfig.data = formData
    }
  }
}

/** 合并配置项，加入容错处理 */
const mergeConfig = (handle: ConfigFn, config: RequestConfig) => {
  const tempConfig = JSON.parse(JSON.stringify(config))
  try {
    const result = handle(tempConfig)
    // 返回结果是个对象，则合并配置项， 否则返回原配置
    if (Object.prototype.toString.call(result) === '[object Object]') {
      return { ...config, ...result }
    } else {
      return config
    }
  } catch (error) {
    return config
  }
}

/** 第一层（接入层）：接收封装后的 axios 示例，第二个参数时初始化配置，配置项参考 axios 配置  */
const curringHttp = (axiosInstance: AxiosInstance, initConfig?: ConfigFn) => {
  /** 第二层（封装层）：只接收方法类型，区分请求方式 */
  const request = (method: Method) => {
    /** 第三层（逻辑层）：接收url，如需自定义配置，可传入第二个参数，配置项参考 axios 配置 */
    const requestUrl = (url: string, requestConfig?: ConfigFn) => {
      /** 第四层（业务层）：传递后端接口参数，如需自定义配置，可传入第二个参数，配置项参考 axios 配置 */
      const apiRequest = (payload?: Payload, businessConfig?: ConfigFn): CurringRes => {
        // 请求配置处理
        let payloadConfig: Payload = {}
        if (payload && (payload.data || payload.params || payload.onSuccess || payload.onError)) {
          payloadConfig = { ...payload }
        } else {
          if (method.toLowerCase() === 'get') {
            // 普通 get 请求
            payloadConfig.params = payload || {}
          } else {
            payloadConfig.data = payload || {}
          }
        }

        const envConfig = getConfig()

        // 合并所有请求配置
        let config: RequestConfig = { baseURL: envConfig.baseURL, method, url, headers: {} }
        if (initConfig) config = mergeConfig(initConfig, config)
        if (requestConfig) config = mergeConfig(requestConfig, config)
        if (businessConfig) config = mergeConfig(businessConfig, config)

        // 填充配置项
        if (!axiosInstance) axiosInstance = axios.create()
        if (url) config.url = url
        if (method) config.method = method

        // 设置contentType数据
        setContentTypeData(config, payloadConfig)

        config = { ...config, ...payloadConfig }

        return axiosInstance(config)
          .then(async (res) => {
            let returnData = res.data ?? res
            if (config.onSuccess) returnData = config.onSuccess(returnData)
            const promiseRes: Promise<[null, any]> = Promise.resolve([null, returnData])
            return promiseRes
          })
          .catch(async (error) => {
            let returnData = error
            if (config.onError) returnData = config.onError(error)
            const promiseRes: Promise<[any, null]> = Promise.resolve([returnData, null])
            return promiseRes
          })
      }
      return apiRequest
    }
    return requestUrl
  }

  return {
    get: request('get'),
    post: request('post'),
    put: request('put'),
    patch: request('patch'),
    delete: request('delete'),
  }
}

export default curringHttp
