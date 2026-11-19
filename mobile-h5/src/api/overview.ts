import { request } from './http'

export interface OverviewIncome {
  userId: string
  name: string
  money: number
}

export interface OverviewCategory {
  costTypeId: string
  name: string
  money: number
  count: number
  percent: string
}

export interface OverviewMemberSlices {
  userId: string
  name: string
  slices: OverviewCategory[]
}

export interface MobileOverview {
  totalCost: number
  investCost: number
  consumptionCost: number
  totalIncome: number
  incomes: OverviewIncome[]
  lines: string[]
  members: { userId: string; name: string }[]
  categories: {
    all: OverviewCategory[]
    members: OverviewMemberSlices[]
  }
  minYear: number
  maxYear: number
}

export interface OverviewRecord {
  id: string
  date: string
  payerName: string
  belongName: string
  money: number
  remark: string
}

/** 查询手机概览。不传数量和归属 */
export function getMobileOverview(billId: string, beginDate: string, endDate: string) {
  return request<MobileOverview>({
    url: '/overview/mobile',
    method: 'GET',
    params: { billId, beginDate, endDate },
    silent: true,
  })
}

/** 查询某一分类的原始支出 */
export function getMobileRecords(params: {
  billId: string
  beginDate: string
  endDate: string
  costTypeId: string
  memberId?: string
}) {
  return request<{ total: number; records: OverviewRecord[] }>({
    url: '/overview/mobile/records',
    method: 'GET',
    params,
    silent: true,
  })
}
