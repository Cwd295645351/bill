/** 明细类型，1=支出；2=收入 */
export type InformationType = 1 | 2

/** 记账照片 */
export interface RecordImage {
  id: string
  sort: number
  viewUrl: string
}

/** 账单明细 */
export interface Information {
  /** 明细id */
  id?: string
  /** 账本id */
  billId?: string
  /** 记账人 */
  userId?: string
  /** 明细类型 */
  type?: InformationType
  /** 日期（时间戳） */
  date: number | string
  /** 支出类型（支出数据） */
  costTypeId?: string
  /** 支付方式（支出数据） */
  payMethodId?: string
  /** 报销进度（支出数据） */
  reimbursement?: number
  /** 归属人 id 列表：「全部」为空数组，多人按账本成员顺序 */
  belongUserIds: string[]
  belongUserName?: string
  /** 收入类型（收入数据） */
  incomesTypeId?: string
  costTypeName?: string
  incomesTypeName?: string
  payMethodName?: string
  /** 金额 */
  money: number
  /** 内容 */
  remark: string
  /** 所附照片；没有时为 [] */
  images?: RecordImage[]
}
