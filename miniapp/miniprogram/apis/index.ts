import { request } from '../utils/request'

const V = '/api/v1'

export function getLoginConfig() {
  return request<{ publicKey: string }>({ url: `${V}/common/login_config`, auth: false, silent: true })
}

export function wxBind(data: { bindTicket: string; username: string; password: string }) {
  return request({ url: `${V}/common/wxBind`, method: 'POST', data, auth: false, silent: true })
}

export function getBillList() {
  return request<any[]>({ url: `${V}/bill/list` })
}

export function createBill(name: string) {
  return request({ url: `${V}/bill`, method: 'POST', data: { name } })
}

export function deleteBill(id: string) {
  return request({ url: `${V}/bill`, method: 'DELETE', data: { id } })
}

export function getBillDetail(id: string) {
  return request({ url: `${V}/bill`, data: { id } })
}

export function inviteBill(id: string) {
  return request<string>({ url: `${V}/bill/invite`, method: 'POST', data: { id }, silent: true })
}

export function joinBill(code: string) {
  return request({ url: `${V}/bill/join`, method: 'POST', data: { code }, silent: true })
}

export function getRecordList(data: any) {
  return request<{ total: number; datas: any[] }>({ url: `${V}/transaction/list`, method: 'POST', data })
}

export function addTransaction(data: any) {
  return request({ url: `${V}/transaction`, method: 'POST', data })
}

export function editTransaction(data: any) {
  return request({ url: `${V}/transaction`, method: 'PUT', data })
}

export function deleteTransaction(id: string) {
  return request({ url: `${V}/transaction`, method: 'DELETE', data: { id } })
}

export function getBudget(billId: string, year: number) {
  return request({ url: `${V}/budget/list`, data: { billId, date: year }, silent: true })
}

export function getMonthCost(billId: string) {
  return request<{ totalCost: number }>({ url: `${V}/transaction/currentMonthCost`, data: { billId }, silent: true })
}

export function getBalance(billId: string, beginDate: number, endDate: number) {
  return request<{ totalCost: number; totalIncomes: number; investCost: number }>({
    url: `${V}/overview/balance`,
    data: { billId, beginDate, endDate },
    silent: true
  })
}
