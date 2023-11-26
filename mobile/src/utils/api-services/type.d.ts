import { AxiosRequestConfig, AxiosInstance } from 'axios'

/** 请求载荷 */
export interface Payload {
  /** data对象 */
  data?: Record<string, any> | string
  /** params对象 */
  params?: Record<string, any>
  /** 成功回调 */
  onSuccess?: (res: any) => void
  /** 失败回调 */
  onError?: (res: any) => void
}

/** 接口请求最终数据 */
export type RequestConfig = AxiosRequestConfig & Payload

/** 对 config 配置的回调处理 */
export type ConfigFn = (config: RequestConfig) => RequestConfig

/** 请求方法 */
export type Method = 'get' | 'post' | 'put' | 'patch' | 'delete'

/** 返回为数组 [error, data], 请求成功 error 为 null，请求失败 data 为 null */
export type CurringRes = Promise<[error: any | null, data: any]>
