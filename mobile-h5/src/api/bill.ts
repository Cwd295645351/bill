import { request } from './http'

export function getBillList() {
  return request<any[]>({ url: '/bill/list', method: 'GET' })
}

export function getBillDetail(id: string) {
  return request<any>({ url: '/bill', method: 'GET', params: { id } })
}

export function createBill(name: string) {
  return request({ url: '/bill', method: 'POST', data: { name }, silent: true })
}

export function deleteBill(id: string) {
  return request({ url: '/bill', method: 'DELETE', data: { id }, silent: true })
}

export function inviteBill(id: string) {
  return request<string>({ url: '/bill/invite', method: 'POST', data: { id }, silent: true })
}

export function joinBill(code: string) {
  return request({ url: '/bill/join', method: 'POST', data: { code }, silent: true })
}
