/** 明细类型，1=支出；2=收入 */
export type InformationType = 1 | 2

/** 账单明细 */
export interface Information {
  /** 明细id */
  id?: string
  /** 明细id */
  _id?: string
  /** 账本id */
  billId?: string
  /** 明细类型 */
  type?: InformationType
  /** 日期 */
  date: string
  /** 支出类型（支出数据） */
  costTypeId?: string
  /** 支付方式（支出数据） */
  payMethodId?: string
  /** 报销进度（支出数据） */
  reimbursement?: number
  /** 归属人（支出数据） */
  belongUserId: string
  /** 收入类型（收入数据） */
  incomesTypeId?: string
  /** 金额 */
  money: number
  /** 内容 */
  remark: string
}

/** 归属人支出明细 */
export interface BelongUserCost {
  /** 归属人id */
  belongUserId: string
  /** 归属人名称 */
  belongUserName: string
  /** 记账人id */
  userId: string
  /** 记账人名称 */
  userName: string
  /** 金额 */
  money: number
}

/** 本月概览数据 */
export interface MonthOverview {
  /** 总支出 */
  totalCost: number
  /** 团队归属人支出明细 */
  belongUserCosts: BelongUserCost[]
  /** 预算 */
  budget: number
}
