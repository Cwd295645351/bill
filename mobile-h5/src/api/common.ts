import { request } from './http'

export function getLoginConfig() {
  return request<{ publicKey: string }>({
    url: '/common/login_config',
    method: 'GET',
    silent: true,
  })
}

export function login(data: { username: string; password: string }) {
  return request<{
    accessToken: string
    refreshToken: string
    expiresIn: number
    userInfo: Record<string, any>
  }>({
    url: '/common/login',
    method: 'POST',
    data,
    silent: true,
  })
}

export function refreshToken(token: string) {
  return request({
    url: '/common/refreshToken',
    method: 'PUT',
    data: { refreshToken: token },
    silent: true,
  })
}

export function logout() {
  return request({
    url: '/common/logout',
    method: 'POST',
    silent: true,
  })
}
