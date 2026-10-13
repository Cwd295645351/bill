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

/** 结算结果中的一名当前成员 */
export interface SettlementMember {
  userId: string
  name: string
  /** 扣规则之后的有效收入，可以为负 */
  effectiveIncome: number
  /** 本次分摊权重。全体为 0 时为 1 */
  weight: number
  /** 作为记账人垫付的支出 */
  paid: number
  /** 应承担的支出 */
  borne: number
  /** 垫付减承担。正数表示应收 */
  net: number
}

/** 一笔建议转账 */
export interface SettlementTransfer {
  fromUserId: string
  fromName: string
  toUserId: string
  toName: string
  amount: number
}

/** 支出结构中的一类 */
export interface SettlementSlice {
  costTypeId: string
  name: string
  money: number
}

/** 一名成员的支出结构。一名成员的账本不返回个人结构 */
export interface SettlementMemberPie {
  userId: string
  name: string
  slices: SettlementSlice[]
}

/** 结算接口 data */
export interface SettlementResult {
  /** 仅当前成员，按账本成员 id 升序 */
  members: SettlementMember[]
  /** 直接显示的文案 */
  lines: string[]
  transfers: SettlementTransfer[]
  pies: {
    all: SettlementSlice[]
    members: SettlementMemberPie[]
  }
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
