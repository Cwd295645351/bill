import { Message } from 'element-ui'
import axiosInstance from './axios'
import curringHttp from './curring'
/**
 * @typedef {import('./type').axiosConfig} axiosConfig
 */

/**
 * @description 对config配置的回调处理
 * @callback configCallback
 * @param {axiosConfig} config 请求配置
 * @returns {axiosConfig} config配置
 */

// 成功回调
const onSuccess = (response) => {
  const res = [null, response.data || response]
  return res
}

// 失败回调
const onError = (error) => {
  if (error.response) {
    // http状态码非2XX
    const status = error.response.status
    const messageMap = {
      400: '参数校验错误',
      401: '用户认证失败，请重新登陆',
      404: '接口地址未找到',
      500: '服务器内部错误'
    }
    const message = error.response.message || error.response.data?.message
    Message.error(message || messageMap[status] || '请求失败')
    if (status === 401) {
      mvue.$dtools.logout()
    }
  } else if (error.request) {
    // 请求已发出，但是没有响应，视为断网
    Message.error('网络异常，请检查您的网络情况')
  } else {
    // 取消请求或请求配置异常
    Message.error('请求被取消')
  }
  // 最后返回错误，阻塞代码，并可供业务自行处理
  return Promise.reject(error.response || error)
}

/**
 * - 请求生成器
 * @description 请求生成器
 * @param {string} url - 请求地址
 * @param {configCallback} customConfig - 请求配置回调方法
 */
export default (url, customConfig = () => {}) => {
  return curringHttp(axiosInstance, (config) => {
    config.baseURL = config.baseURL + url
    config.onSuccess = onSuccess
    config.onError = onError
    return customConfig(config) || config
  })
}
