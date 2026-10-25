/** 资产成员 */
export interface AssetMember {
  id: string
  name: string
  billId: string
}

/** 资产类型与四笔钱的可选项 */
export interface AssetOption {
  value: string
  label: string
}

/** 登记和编辑表单 */
export interface AssetForm {
  id: string
  name: string
  memberId: string
  type: string
  fourMoneyType: string
  latestAmount: string
  channel: string
  turnaroundCycle: string
  insuranceCategory: string
  annualPremium: string
  /** CNY、HKD、USD */
  currency: string
}

/** 单笔资产在总览里的一行 */
export interface AssetRow {
  id: string
  name: string
  memberId: string
  memberName: string
  type: string
  fourMoneyType: string
  channel?: string
  turnaroundCycle?: string
  latestAmount: number
  /** 原币金额。编辑和盘点用这个，避免把人民币写回原币 */
  rawAmount?: number
  currency?: string
  isDebt?: boolean
  insuranceCategory?: string
  annualPremium?: number | null
  prevAmount: number | null
  change: number | null
  percent: number
}

/** 按类型汇总的一组资产 */
export interface AssetGroup {
  type: string
  typeName: string
  amount: number
  change: number | null
  percent: number
  assets: AssetRow[]
}

/** 总览分组数据 */
export interface AssetStats {
  assetAmount: number
  debtAmount: number
  netAmount: number
  assetGroups: AssetGroup[]
  debtGroups: AssetGroup[]
}

/** 与上月末对比 */
export interface CategoryChange {
  type: string
  typeName: string
  current: number
  prev: number
  change: number
}

export interface AssetOverview {
  netAmount: number
  assetAmount: number
  debtAmount: number
  referenceDate: string
  totalChange: number
  debtChange?: number
  categoryChanges: CategoryChange[]
  /** 上一个盘点日。没有则为空 */
  defaultAsOf?: string
  earliestRecordMonth?: string
  hkdRate?: number
  usdRate?: number
  ratesSaved?: boolean
}

/** 一条盘点 */
export interface AssetRecordItem {
  id: string
  assetId: string
  amount: number
  date: number
}

/** 四笔钱里的一项资产 */
export interface FourMoneyAsset {
  id: string
  name: string
  latestAmount: number
  rawAmount?: number
  currency?: string
  type?: string
  fourMoneyType?: string
  channel?: string
  turnaroundCycle?: string
  isDebt: boolean
  memberId?: string
  member?: { name?: string }
  insuranceCategory?: string
  annualPremium?: number | null
}

export interface FourMoneyBucket {
  name: string
  amount: number
  count: number
  assets: FourMoneyAsset[]
  totalPremium?: number
  categories?: Record<string, number>
}

export type FourMoneySummary = Record<string, FourMoneyBucket>

/** 桑基图节点和带子 */
export interface SankeyNode {
  id: string
  name: string
  memberName?: string
  detail?: string
  kind?: string
}

export interface SankeyLink {
  source: string
  target: string
  value: number
}

export interface SankeyData {
  nodes: SankeyNode[]
  links: SankeyLink[]
}

/** 月历里的一个类别 */
export interface MonthSeries {
  current: number | null
  yearChange: number | null
  lastUpdate: string
  monthlyData: (number | null)[]
}

export type MonthlyReport = Record<string, MonthSeries>
