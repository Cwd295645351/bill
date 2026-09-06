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

/** 数量型规则在概览查询中的输入 */
export interface QuantityRuleInput {
  /** 数量 */
  quantity: number | string
  /** 归属用户 id */
  belongUserId: string
}

/** 比例 */
export interface BelongCondition {
  /** 开始时间（时间戳） */
  startDate: number | ''
  /** 结束时间（时间戳） */
  endDate: number | ''
  /** 数量型规则查询值，按规则 ID 索引 */
  quantityInputs: Record<string, QuantityRuleInput>
  /** 退款金额 */
  refundMoney: number
}
