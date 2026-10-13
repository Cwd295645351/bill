import { PROD_BASE_URL } from './env.local'

/**
 * 按小程序版本切换接口根地址。
 * develop：开发者工具，可勾选不校验合法域名后直连本机。
 * trial / release：读取本地 miniapp/.env 的 MINIAPP_BASE_URL（经 sync-env 写入 env.local.ts，不入库）。
 */
const HOSTS: Record<string, string> = {
  develop: 'http://10.133.128.51:3000',
  trial: PROD_BASE_URL,
  release: PROD_BASE_URL
}

/** 当前环境的接口根地址，不含末尾斜杠 */
export function getBaseURL(): string {
  let version = 'release'
  try {
    version = wx.getAccountInfoSync().miniProgram.envVersion || 'release'
  } catch (err) {
    version = 'release'
  }
  const baseURL = HOSTS[version] || PROD_BASE_URL
  if (!baseURL) {
    console.error('未配置 MINIAPP_BASE_URL，请在 miniapp/.env 填写后执行 npm run sync-env')
  }
  return baseURL
}
