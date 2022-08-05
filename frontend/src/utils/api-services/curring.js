/*
 * @Author: xiechaopeng
 * @Date: 2021-06-25 08:46:44
 * @LastEditors: ChenWeidong
 * @LastEditTime: 2022-05-31 16:44:53
 * @Description: 柯里化http工具
 */

/**
 * @typedef {import('./type').axiosConfig} axiosConfig
 */

/**
 * @typedef {import('./type').axiosInstance} Instance
 */

/**
 * @description 对config配置的回调处理
 * @callback configCallback
 * @param {axiosConfig} config 请求配置
 * @returns {axiosConfig} config配置
 */

/**
 * @typedef {object} Payload - 请求载荷
 * @property {object} data - data对象
 * @property {object} params - params对象
 * @property {function} onSuccess - 成功回调
 * @property {function} onError - 失败回调
 */

import axios from "axios"
import getEnv from "../getEnv"

/**
 * 根据 contentType 格式转化请求数据
 * @param {axiosConfig} config - 请求配置
 * @param {Payload} payloadConfig - 请求载荷
 */
// 根据 contentType 格式转化请求数据
const setContentTypeData = (config, payloadConfig) => {
	const contentType = config.headers?.["Content-Type"]
	if (contentType !== "application/x-www-form-urlencoded" && contentType !== "multipart/form-data") {
		return
	}
	const data = payloadConfig.data
	if (contentType === "application/x-www-form-urlencoded") {
		if (data) {
			let str = ""
			for (const key in data) {
				str += `&${key}=${data[key]}`
			}
			payloadConfig.data = str.slice(1)
		}
	} else if (contentType === "multipart/form-data") {
		if (data) {
			const formData = new FormData()
			for (const key in data) {
				formData.append(key, data[key])
			}
			payloadConfig.data = formData
		}
	}
}

/**
 * 合并配置项，加入容错处理
 * @param {configCallback} handle - 合并方法，由用户传递
 * @param {axiosConfig} config - 请求配置
 * @returns {axiosConfig} config配置
 */
function mergeConfig(handle, config) {
	const tempConfig = JSON.parse(JSON.stringify(config))
	try {
		const result = handle(tempConfig)
		// 返回结果是个对象，则合并配置项， 否则返回原配置
		if (Object.prototype.toString.call(result) === "[object Object]") {
			return { ...config, ...result }
		} else {
			return config
		}
	} catch (error) {
		return config
	}
}
/**
 * 第一层（接入层）：接收封装后的axios实例，第二个参数是初始化配置，配置项参考AxiosRequestConfig
 * @function curringHttp
 * @param {Instance} axiosInstance - axios请求实例
 * @param {configCallback} initConfig - 请求配置回调
 */
function curringHttp(axiosInstance, initConfig = () => {}) {
	/**
	 * 第二层（封装层）：只接收方法类型，区分请求方式
	 * @function request
	 * @param {string} method - 请求方法
	 * @returns {requestUrl} 业务请求方法
	 */
	function request(method) {
		/**
		 * 第三层（逻辑层）：接收url，如需自定义配置可传第二个参数，配置项参考AxiosRequestConfig
		 * @function requestUrl
		 * @param {string} url - 请求url
		 * @param {configCallback} requestConfig - 请求配置回调
		 * @returns {apiRequest} api请求或者webSock请求方法
		 */
		function requestUrl(url, requestConfig = () => {}) {
			/**
			 * 第四层（业务层）：传递后端接口参数，第二个参数为自定义配置，配置项参考AxiosRequestConfig，另外满足业务需求增加onError
			 * @function apiRequest
			 * @param {object} payload - 请求载荷
			 * @param {object} payload.data - data对象
			 * @param {object} payload.params - params对象
			 * @param {function} payload.onSuccess - 成功回调
			 * @param {function} payload.onError - 失败回调
			 * @param {configCallback} businessConfig - 请求配置回调
			 */
			function apiRequest(payload, businessConfig = () => {}) {
				// 数据处理
				let payloadConfig = {}
				if (payload && (payload.data || payload.params || payload.onSuccess || payload.onError)) {
					payloadConfig = { ...payload }
				} else {
					if (method.toLowerCase() === "get") {
						// 普通get请求
						payloadConfig.params = payload || {}
					} else {
						payloadConfig.data = payload || {}
					}
				}

				const env = getEnv()
				// 合并所有配置
				let config = { baseURL: env.baseURL, method, url, headers: {}, axiosInstance }
				config = mergeConfig(initConfig, config)
				config = mergeConfig(requestConfig, config)
				config = mergeConfig(businessConfig, config)

				// 填充配置项
				if (!axiosInstance) axiosInstance = config.axios || axios.create
				if (url) config.url = url
				if (method) config.method = method

				// 设置contentType数据
				setContentTypeData(config, payloadConfig)

				config = { ...config, ...payloadConfig }

				// 发起请求
				/**
				 * 返回格式
				 * [
				 *   error: 接口请求正常时为空，
				 *   data: 后端返回数据
				 * ]
				 */
				return axiosInstance(config)
					.then((res) => {
						if (config.onSuccess) return config.onSuccess(res)
						return [null, res.data || res]
					})
					.catch((error) => {
						if (config.onError) config.onError(error)
						return Promise.resolve([error, null])
					})
			}
			return apiRequest
		}
		return requestUrl
	}

	return {
		get: request("get"),
		post: request("post"),
		put: request("put"),
		patch: request("patch"),
		delete: request("delete")
	}
}

export default curringHttp
