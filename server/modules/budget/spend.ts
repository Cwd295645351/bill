import { Op } from 'sequelize'
import { toTimestamp } from '../../utils/dateUtil'

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
