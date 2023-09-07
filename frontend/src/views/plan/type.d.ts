/** 优先级：1=高，2=中，3=低 */
export type Priority = 1 | 2 | 3

/** 计划列表接口返回数据 */
export interface PlanResponse {
  _id: string
  /** 标题 */
  title: string
  /** 内容 */
  context: string
  /** 优先级 */
  priority: Priority
  /** 是否已购 */
  isBuy: boolean
}

export interface PlanItem {
  _id: string
  /** 标题 */
  title: string
  /** 内容 */
  context: string
  /** 优先级 */
  priority: Priority
}

/** 计划表单 */
export interface PlanForm {
  /** id */
  id?: string
  /** 账本id */
  billId: string
  /** 内容 */
  context: string
  /** 标题 */
  title: string
  /** 优先级 */
  priority: Priority
}
