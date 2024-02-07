/** 账本 */
export interface Bill {
  id: string
  _id: string
  /** 计划购入 */
  planBuy: PlanBuy
  /** 预算清单 */
  budget: Budget[]
  /** 账本名 */
  name: string
  /** 账本持有者-存放用户 id 和 name */
  users: User[]
  /** 账本创建者（拥有新建、编辑、删除账本权限） */
  creator: string
  costTypes: CostType[]
  incomesTypes: IncomesType[]
  payMethods: PayMethod[]
}

/** 用户信息 */
export interface User {
  id: string
  name: string
}

/** 账本支出消费类型 */
export interface CostType {
  id: string
  name: string
}

/** 账本收入消费类型 */
export interface IncomesType {
  id: string
  name: string
}

/** 支付类型 */
export interface PayMethod {
  id: string
  name: string
}

/** 计划购入 */
export interface PlanBuy {
  /** 数量 */
  count: number
  /** 总花费 */
  totalCost: number
  /** 明细 */
  details: {
    id: string
    /** 预购内容 */
    name: string
    /** 支出类型id */
    costTypeId: string
    /** 支出类型名称 */
    costTypeName: string
    /** 金额 */
    cost: number
    /** 排序 */
    sort: number
  }[]
}

/** 预算 */
export interface Budget {
  /** 年份 */
  date: number
  /** 总预算 */
  totalBudget: number
  /** 当前已支出金额 */
  currCost: number
  /** 明细 */
  details: BudgetDetail[]
}

/** 预算明细 */
export interface BudgetDetail {
  /** 预算明细id */
  _id?: string
  /** 支出类型id */
  costTypeId: string
  /** 支出类型名称 */
  costTypeName: string
  /** 预算金额 */
  budget: number
  /**  当前已支出金额(在增删修改账本时顺便对cost进行修改) */
  cost: number
  /** 当前支出进度 */
  costPercent?: number
}
