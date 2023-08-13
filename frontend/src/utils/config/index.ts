import type { Config } from '@/types/config'

export const getConfig = (): Config => {
  const windowConfig = window.config || {}
  let config = { ...windowConfig }
  if (!config.baseURL) config.baseURL = location.origin
  if (!config.version) config.version = 'v1'
  return config
}
