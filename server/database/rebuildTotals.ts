import type { Sequelize } from 'sequelize'
import type { AnyModel } from '../types/model'
import { yearFromTimestamp } from '../utils/dateUtil'
import { countsAsExpense } from '../modules/budget/spend'

type MoneyRow = {
  id?: string | null
  userId?: string | null
  billId?: string | null
  type?: number | string | null
  money?: number | string | null
  date?: number | string | null
  costTypeId?: string | null
  reimbursement?: number | string | null
}

type BudgetRow = { id?: string; billId?: string; date?: number | string | null }
type DetailRow = { id?: string; budgetId?: string; costTypeId?: string | null }

type TotalModels = {
  sequelize: Sequelize
  User: AnyModel
  Transaction: AnyModel
  BillBudget: AnyModel
  BillBudgetDetail: AnyModel
}

const round2 = (value: number) => Number(value.toFixed(2))

const add = (bag: Map<string, number>, key: string, money: number) => {
  bag.set(key, (bag.get(key) || 0) + money)
}

/**
 * 按现行规则重算用户累计和预算已用。
 * 只统计未删除流水：收入进累计收入，未报销支出进累计支出、年度已用和分类已用。
 */
export async function rebuildLedgerTotals(models: TotalModels) {
  const rows = (await models.Transaction.findAll({
    where: { isDel: false },
    attributes: ['userId', 'billId', 'type', 'money', 'date', 'costTypeId', 'reimbursement'],
    raw: true
  })) as MoneyRow[]
  const expenses = new Map<string, number>()
  const incomes = new Map<string, number>()
  const yearCost = new Map<string, number>()
  const typeCost = new Map<string, number>()
  for (const row of rows) {
    const money = Number(row.money)
    if (!Number.isFinite(money)) continue
    const userId = String(row.userId || '')
    if (Number(row.type) === 2) {
      if (userId) add(incomes, userId, money)
      continue
    }
    if (!countsAsExpense(row.type, row.reimbursement)) continue
    if (userId) add(expenses, userId, money)
    const billId = String(row.billId || '')
    const year = yearFromTimestamp(row.date as number)
    if (!billId || !Number.isFinite(year)) continue
    const yearKey = `${billId}:${year}`
    add(yearCost, yearKey, money)
    const costTypeId = String(row.costTypeId || '')
    if (costTypeId) add(typeCost, `${yearKey}:${costTypeId}`, money)
  }

  const tx = await models.sequelize.transaction()
  try {
    const users = (await models.User.findAll({ attributes: ['id'], raw: true, transaction: tx })) as MoneyRow[]
    for (const user of users) {
      const id = String(user.id || '')
      if (!id) continue
      await models.User.update(
        { expenses: round2(expenses.get(id) || 0), incomes: round2(incomes.get(id) || 0) },
        { where: { id }, transaction: tx }
      )
    }
    const budgets = (await models.BillBudget.findAll({ transaction: tx, raw: true })) as BudgetRow[]
    for (const budget of budgets) {
      const id = String(budget.id || '')
      const yearKey = `${String(budget.billId || '')}:${Number(budget.date)}`
      await models.BillBudget.update(
        { currCost: round2(yearCost.get(yearKey) || 0) },
        { where: { id }, transaction: tx }
      )
      const details = (await models.BillBudgetDetail.findAll({
        where: { budgetId: id },
        transaction: tx,
        raw: true
      })) as DetailRow[]
      for (const detail of details) {
        const cost = typeCost.get(`${yearKey}:${String(detail.costTypeId || '')}`) || 0
        await models.BillBudgetDetail.update(
          { cost: round2(cost) },
          { where: { id: detail.id }, transaction: tx }
        )
      }
    }
    await tx.commit()
  } catch (error) {
    await tx.rollback()
    throw error
  }
}
