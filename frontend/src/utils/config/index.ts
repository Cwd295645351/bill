import type { Config } from '@/types/config'

export const getConfig = (): Config => {
  const config = {
    baseURL: import.meta.env.VITE_BASEURL,
    version: import.meta.env.VITE_VERSION,
  }
  return config
}
