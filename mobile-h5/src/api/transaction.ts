import { request } from './http'

export function getRecordList(data: Record<string, any>) {
  return request<{ total: number; datas: any[] }>({
    url: '/transaction/list',
    method: 'POST',
    data,
  })
}

export function addTransaction(data: Record<string, any>) {
  return request({ url: '/transaction/', method: 'POST', data, silent: true })
}

export function editTransaction(data: Record<string, any>) {
  return request({ url: '/transaction/', method: 'PUT', data, silent: true })
}

export function deleteTransaction(id: string) {
  return request({ url: '/transaction/', method: 'DELETE', data: { id }, silent: true })
}

export function getMonthCost(billId: string) {
  return request<{ totalCost: number }>({
    url: '/transaction/currentMonthCost',
    method: 'GET',
    params: { billId },
    silent: true,
  })
}

/** 年度预算（date 传年份，与小程序 getBudget 一致） */
export function getBudget(billId: string, year: number) {
  return request<{ totalBudget: number; currCost: number }>({
    url: '/budget/list',
    method: 'GET',
    params: { billId, date: year },
    silent: true,
  })
}

/** 区间收支汇总（含投资） */
export function getBalance(billId: string, beginDate: number, endDate: number) {
  return request<{ totalCost: number; totalIncomes: number; investCost: number }>({
    url: '/overview/balance',
    method: 'GET',
    params: { billId, beginDate, endDate },
    silent: true,
  })
}

/** 上传一张记账照片，返回未挂接的照片 id（与小程序 uploadTransactionImage 一致） */
export function uploadTransactionImage(billId: string, file: File) {
  const form = new FormData()
  form.append('file', file)
  form.append('billId', billId)
  return request<{ id: string }>({
    url: '/transaction/image',
    method: 'POST',
    data: form,
    silent: true,
  })
}
