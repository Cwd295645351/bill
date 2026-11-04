import { request } from './http'
import http from './http'

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

export function updateProfile(nickName: string) {
  return request({
    url: '/common/profile',
    method: 'PUT',
    data: { nickName },
  })
}

export function changePassword(oldPassword: string, newPassword: string) {
  return request<{ requireRelogin: boolean }>({
    url: '/common/password',
    method: 'PUT',
    data: { oldPassword, newPassword },
  })
}

export async function uploadAvatar(file: File) {
  const form = new FormData()
  form.append('file', file)
  const res = await http.post('/common/avatar', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return res.data
}