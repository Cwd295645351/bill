import { Op } from 'sequelize'
import { toTimestamp } from '../../utils/dateUtil'

/** 预算年份及其分项。只保留本次增减会改到的字段 */
export type SpendBudget = {
  date?: number | string | null
  totalBudget?: number
  currCost?: number
  details?: { costTypeId?: string | null; cost?: number }[]
}

/** 未报销的支出才计入预算已用和用户总支出。空值视为未报销 */
export const countsAsExpense = (type: unknown, reimbursement: unknown) =>
  Number(type) === 1 && Number(reimbursement || 0) === 0

/** 查询未报销支出时可展开进 where */
export const unreimbursedExpenseWhere = {
  type: 1,
  [Op.or]: [{ reimbursement: 0 }, { reimbursement: null }]
}

/** 金额必须是大于 0 的有限数字 */
export const readPositiveMoney = (value: unknown): [string, null] | [null, number] => {
  if (value === undefined || value === null || value === '') return ['金额不能为空', null]
  const amount = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(amount) || amount <= 0) return ['金额不正确', null]
  return [null, Number(amount.toFixed(2))]
}

/** 记账日期必须能解析成时间戳 */
export const readBookDate = (value: unknown): [string, null] | [null, number] => {
  const ts = toTimestamp(value as string | number | Date | null | undefined)
  if (ts == null || !Number.isFinite(ts)) return ['记账时间不正确', null]
  return [null, ts]
}

/**
 * 按年份和支出类型增减已用金额。
 * 减记时年份不存在则跳过，避免凭空造出负年份。
 */
export const shiftBudgetSpend = (
  budgets: SpendBudget[],
  year: number,
  costTypeId: unknown,
  delta: number
) => {
  if (!delta || !Number.isFinite(year)) return
  let item = budgets.find((row) => Number(row.date) === year)
  if (!item) {
    if (delta < 0) return
    item = { date: year, totalBudget: 0, currCost: 0, details: [] }
    budgets.push(item)
  }
  item.currCost = Number(item.currCost || 0) + delta
  if (costTypeId == null || costTypeId === '' || !item.details) return
  const detail = item.details.find((row) => row.costTypeId === costTypeId)
  if (detail) detail.cost = Number(detail.cost || 0) + delta
}
