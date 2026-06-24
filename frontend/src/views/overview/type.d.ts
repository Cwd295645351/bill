/** 归属人配置项 */
export interface BelongUser {
  /** 总支出 */
  totalCost: number
  /** 总收入 */
  totalIncomes: number
  /** 总投资支出 */
  investCost: number
  /** 总消费支出 */
  consumptionCost: number
  details: any[]
}

/** 比例 */
export interface BelongCondition {
  /** 开始时间（时间戳） */
  startDate: number | ''
  /** 结束时间（时间戳） */
  endDate: number | ''
  /** 香港天数 */
  days: number
  /** 退款金额 */
  refundMoney: number
}
