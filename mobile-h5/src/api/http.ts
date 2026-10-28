import axios, { type AxiosRequestConfig } from 'axios'
import { showToast } from 'vant'
import { useSessionStore } from '@/stores/session'
import router from '@/router'

export interface ResModel<T = any> {
  retCode: number
  message: string
  data: T
}

type RequestConfig = AxiosRequestConfig & { silent?: boolean }

const http = axios.create({
  baseURL: '/api/v1',
  timeout: 30000,
})

let refreshing: Promise<boolean> | null = null

http.interceptors.request.use((config) => {
  const session = useSessionStore()
  const token = session.accessToken
  if (!config.headers) config.headers = {} as any
  if (token) {
    ;(config.headers as any).Authorization = `bearer ${token}`
  }
  if (session.userInfo?.userId) {
    ;(config.headers as any).userId = session.userInfo.userId
  }
  if (session.userInfo?.nickName) {
    ;(config.headers as any).nickName = encodeURIComponent(session.userInfo.nickName)
  }
  return config
})

async function tryRefresh(): Promise<boolean> {
  const session = useSessionStore()
  const rt = session.refreshToken
  if (!rt) return false
  try {
    const res = await axios.put<
      ResModel<{
        accessToken: string
        refreshToken: string
        expiresIn: number
        userId?: string
      }>
    >(
      '/api/v1/common/refreshToken',
      { refreshToken: rt },
      {
        headers: {
          Authorization: `bearer ${session.accessToken || ''}`,
          userId: session.userInfo?.userId || '',
          nickName: encodeURIComponent(session.userInfo?.nickName || ''),
        },
      },
    )
    if (res.data?.retCode === 0 && res.data.data) {
      session.patchTokens(res.data.data)
      return true
    }
  } catch {
    /* ignore */
  }
  return false
}

function forceLogin(message?: string) {
  const session = useSessionStore()
  session.clearSession()
  if (message) showToast(message)
  const redirect = router.currentRoute.value.fullPath
  if (router.currentRoute.value.name !== 'login') {
    router.replace({
      name: 'login',
      query: redirect && redirect !== '/login' ? { redirect } : {},
    })
  }
}

http.interceptors.response.use(
  async (response) => {
    const body = response.data as ResModel
    if (body && body.retCode === 401) {
      if (!refreshing) refreshing = tryRefresh().finally(() => { refreshing = null })
      const ok = await refreshing
      if (ok) return http.request(response.config)
      forceLogin(body.message || '登录已失效，请重新登录')
      return Promise.reject(body)
    }
    return response
  },
  async (error) => {
    const status = error?.response?.status
    const silent = Boolean((error?.config as RequestConfig | undefined)?.silent)
    if (status === 401) {
      if (!refreshing) refreshing = tryRefresh().finally(() => { refreshing = null })
      const ok = await refreshing
      if (ok && error.config) return http.request(error.config)
      forceLogin(error?.response?.data?.message || '登录已失效，请重新登录')
    } else if (!silent) {
      showToast(error?.response?.data?.message || '网络异常')
    }
    return Promise.reject(error)
  },
)

export async function request<T = any>(config: RequestConfig): Promise<ResModel<T>> {
  const res = await http.request<ResModel<T>>(config)
  return res.data
}

export default http
