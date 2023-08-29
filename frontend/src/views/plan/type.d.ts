/** 优先级：1=高，2=中，3=低 */
export type Priority = 1 | 2 | 3

export interface PlanItem {
    _id?: string
    /** 内容 */
    context: string
    /** 优先级 */
    priority: Priority
    /** 是否已购 */
    isBuy: boolean
}