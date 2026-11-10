import { request } from './http'

export interface BudgetDetail {
  id: string
  costTypeId: string
  costTypeName: string
  budget: number
  cost: number
}

export interface YearBudget {
  totalBudget: number
  currCost: number
  details: BudgetDetail[]
}

/** 查询某账本某自然年预算（含 details） */
export function getBudgetList(billId: string, year: number) {
  return request<YearBudget>({
    url: '/budget/list',
    method: 'GET',
    params: { billId, date: year },
    silent: true,
  })
}

/** 兼容明细页旧调用名 */
export function getBudget(billId: string, year: number) {
  return getBudgetList(billId, year)
}

export function budgetAdd(data: {
  billId: string
  date: number
  costTypeId: string
  money: number
}) {
  return request({ url: '/budget', method: 'POST', data, silent: true })
}

export function budgetEdit(data: {
  id: string
  billId: string
  date: number
  money: number
}) {
  return request({ url: '/budget', method: 'PUT', data, silent: true })
}

export function budgetDelete(params: { id: string; billId: string; date: number }) {
  return request({ url: '/budget', method: 'DELETE', params, silent: true })
}
