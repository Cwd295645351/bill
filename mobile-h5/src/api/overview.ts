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
  /** 当前全部成员的有效收入，允许为负 */
  effectiveIncomes: OverviewIncome[]
  lines: string[]
  members: { userId: string; name: string }[]
  categories: {
    all: OverviewCategory[]
    members: OverviewMemberSlices[]
  }
  minYear: number
  maxYear: number
  /** 支出与收入区间，毫秒时间戳 */
  expenseBeginDate: number
  expenseEndDate: number
  incomeBeginDate: number
  incomeEndDate: number
}

export interface OverviewRecord {
  id: string
  date: string
  payerName: string
  belongName: string
  money: number
  remark: string
}

/** 查询手机概览。只在打开累计收入时附带查询参数 */
export function getMobileOverview(billId: string, beginDate: string, endDate: string, cumulativeIncome?: boolean) {
  return request<MobileOverview>({
    url: '/overview/mobile',
    method: 'GET',
    params: {
      billId,
      beginDate,
      endDate,
      ...(cumulativeIncome ? { cumulativeIncome: 'true' } : {}),
    },
    silent: true,
  })
}

/** 查询某一分类的原始支出。与电脑概览共用 */
export function getCategoryRecords(params: {
  billId: string
  beginDate: string
  endDate: string
  costTypeId: string
  memberId?: string
}) {
  return request<{ total: number; records: OverviewRecord[] }>({
    url: '/overview/records',
    method: 'GET',
    params,
    silent: true,
  })
}
