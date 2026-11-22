import { request } from './http'

export interface AssetMember {
  id: string
  name: string
  billId: string
}

export interface AssetRow {
  id: string
  name: string
  memberId: string
  memberName: string
  /** 四笔钱接口把名字放在 member.name，列表统计放在 memberName。 */
  member?: { name?: string }
  type: string
  fourMoneyType: string
  channel?: string
  turnaroundCycle?: string
  latestAmount: number
  rawAmount?: number
  currency?: string
  isDebt?: boolean
  insuranceCategory?: string
  annualPremium?: number | null
  prevAmount: number | null
  change: number | null
  percent: number
}

export interface AssetGroup {
  type: string
  typeName: string
  amount: number
  change: number | null
  percent: number
  assets: AssetRow[]
}

export interface AssetStats {
  assetAmount: number
  debtAmount: number
  netAmount: number
  assetGroups: AssetGroup[]
  debtGroups: AssetGroup[]
}

export interface AssetOverview {
  netAmount: number
  assetAmount: number
  debtAmount: number
  referenceDate: string
  totalChange: number
  debtChange?: number
  defaultAsOf?: string
  earliestRecordMonth?: string
  hkdRate?: number
  usdRate?: number
  ratesSaved?: boolean
}

export interface AssetRecordItem {
  id: string
  assetId: string
  amount: number
  date: number
}

export interface AssetRecordPage {
  list: AssetRecordItem[]
  total: number
  page: number
  pageSize: number
}

export interface FourBucket {
  name: string
  amount: number
  count: number
  assets: AssetRow[]
  totalPremium?: number
}

export type FourSummary = Record<string, FourBucket>

export interface MonthSeries {
  current: number | null
  yearChange: number | null
  lastUpdate: string
  monthlyData: (number | null)[]
}

export type MonthlyReport = Record<string, MonthSeries>

export interface TrendSeries {
  key: string
  name: string
  values: (number | null)[]
}

export interface TrendLegend {
  key: string
  first: number | null
  last: number | null
  delta: number | null
}

export interface TrendResult {
  labels: string[]
  series: TrendSeries[]
  legend: TrendLegend[]
  capped?: boolean
  startMonth: string
  endMonth: string
}

export interface ExchangeRate {
  hkdRate: number
  usdRate: number
  saved: boolean
}

export interface LedgerRule {
  name: string
  unitName: string
  unitPrice: number
  quantity: number
  belongUserName: string
}

export interface LedgerResult {
  year: number
  years: number[]
  endMonth: string
  openingMonth: string
  openingAsset: number | null
  closingAsset: number | null
  income: number
  expense: number
  surplus: number
  exclusive: number
  sharedShare: number
  publicShare: number
  effectiveIncome: { userId: string; name: string; effectiveIncome: number }[]
  unmatched: boolean
  message: string
  assetChange: number | null
  netChange: number | null
  diff: number | null
  equal: boolean | null
  quantityRules: LedgerRule[]
}

export interface RetirePlan {
  amount: number
  startMonth: string
  targetMonth: string | null
}

export interface RetireResult {
  plan: RetirePlan | null
  monthlyIncome: number
  monthlyExpense: number
  idleMonths: { name: string; month: string }[]
  skipIdle: boolean
  unmatched: boolean
  message: string
  netWorth: number
  series: { month: string; value: number | null }[]
}

export interface AssetPayload {
  id?: string
  name: string
  billId: string
  memberId: string
  type: string
  fourMoneyType: string
  latestAmount: number
  currency: string
  channel?: string
  turnaroundCycle?: string
  insuranceCategory?: string
  annualPremium?: string | number
}

function members(billId: string) {
  return request<AssetMember[]>({ url: '/asset/members', method: 'GET', params: { billId } })
}

function listStats(billId: string, memberId?: string) {
  return request<AssetStats>({ url: '/asset/list-stats', method: 'GET', params: { billId, memberId: memberId || undefined } })
}

function overview(billId: string, memberId?: string, asOf?: string) {
  return request<AssetOverview>({
    url: '/asset/overview',
    method: 'GET',
    params: { billId, memberId: memberId || undefined, asOf: asOf || undefined }
  })
}

function addMember(billId: string, name: string) {
  return request<AssetMember>({ url: '/asset/member', method: 'POST', data: { billId, name } })
}

function editMember(id: string, name: string) {
  return request<AssetMember>({ url: '/asset/member', method: 'PUT', data: { id, name } })
}

function hideMember(id: string) {
  return request({ url: '/asset/member', method: 'DELETE', params: { id } })
}

function addAsset(data: AssetPayload) {
  return request({ url: '/asset', method: 'POST', data })
}

function editAsset(data: AssetPayload) {
  return request({ url: '/asset', method: 'PUT', data })
}

function deleteAsset(id: string) {
  return request({ url: '/asset', method: 'DELETE', params: { id } })
}

function records(assetId: string, page: number) {
  return request<AssetRecordPage>({ url: '/asset/records', method: 'GET', params: { assetId, page, pageSize: 10 } })
}

function saveRecord(data: { id?: string; assetId: string; amount: number; date: number }, editing: boolean) {
  return request({ url: '/asset/record', method: editing ? 'PUT' : 'POST', data })
}

function deleteRecord(id: string) {
  return request({ url: '/asset/record', method: 'DELETE', params: { id } })
}

function exchangeRate(billId: string) {
  return request<ExchangeRate>({ url: '/asset/exchange-rate', method: 'GET', params: { billId } })
}

function saveExchangeRate(billId: string, hkdRate: string, usdRate: string) {
  return request<ExchangeRate>({ url: '/asset/exchange-rate', method: 'PUT', data: { billId, hkdRate, usdRate } })
}

function fourMoney(billId: string, memberId?: string) {
  return request<FourSummary>({ url: '/asset/four-money', method: 'GET', params: { billId, memberId: memberId || undefined } })
}

function monthlyReport(billId: string, year: number, memberId?: string) {
  return request<MonthlyReport>({ url: '/asset/monthly-report', method: 'GET', params: { billId, year, memberId: memberId || undefined } })
}

function trend(params: { billId: string; memberId?: string; startMonth: string; endMonth: string; grain: string; metric: string }) {
  return request<TrendResult>({
    url: '/asset/trend',
    method: 'GET',
    params: { ...params, memberId: params.memberId || undefined }
  })
}

function ledger(billId: string, year: number, memberId?: string) {
  return request<LedgerResult>({
    url: '/asset/ledger',
    method: 'POST',
    data: { billId, year, memberId: memberId || undefined }
  })
}

function retirePlan(params: { billId: string; memberId?: string; incomeYears: number; expenseYears: number; skipIdle: string }) {
  return request<RetireResult>({
    url: '/asset/retire-plan',
    method: 'GET',
    params: { ...params, memberId: params.memberId || undefined }
  })
}

function saveRetirePlan(data: { billId: string; memberId?: string; amount: number; startMonth: string; targetMonth?: string }) {
  return request({ url: '/asset/retire-plan', method: 'PUT', data })
}

export const assetApi = {
  members,
  listStats,
  overview,
  addMember,
  editMember,
  hideMember,
  addAsset,
  editAsset,
  deleteAsset,
  records,
  saveRecord,
  deleteRecord,
  exchangeRate,
  saveExchangeRate,
  fourMoney,
  monthlyReport,
  trend,
  ledger,
  retirePlan,
  saveRetirePlan
}
