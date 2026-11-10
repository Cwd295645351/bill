import { request } from './http'

/** 优先级：1=高，2=中，3=低 */
export type PlanPriority = 1 | 2 | 3

export interface PlanItem {
  id: string
  title: string
  context: string
  priority: PlanPriority
}

export interface PlanList {
  count: number
  details: PlanItem[]
}

/** 查询账本可见计划列表 */
export function getPlanList(billId: string) {
  return request<PlanList>({
    url: '/plan/list',
    method: 'GET',
    params: { billId },
    silent: true,
  })
}

export function planAdd(data: {
  billId: string
  title: string
  context: string
  priority: PlanPriority
}) {
  return request({ url: '/plan', method: 'POST', data, silent: true })
}

export function planEdit(data: {
  id: string
  billId: string
  title: string
  context: string
  priority: PlanPriority
}) {
  return request({ url: '/plan', method: 'PUT', data, silent: true })
}

export function planDelete(params: { id: string; billId: string }) {
  return request({ url: '/plan', method: 'DELETE', params, silent: true })
}
