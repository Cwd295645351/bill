/** 归属人配置项 */
export interface BelongUser {
  /** 总支出 */
  totalCost: number
  /** 总收入 */
  totalIncomes: number
  details: any[]
}

/** 比例 */
export interface BelongCondition {
  /** 开始时间 */
  startDate: string
  /** 结束时间 */
  endDate: string
  /** 比例 */
  proportion: string
  /** 金额 */
  money: number
}
