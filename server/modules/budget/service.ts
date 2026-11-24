import { toPlain, type Row, type WhereBag } from '../../types/domain'
import { BillBudget, BillBudgetDetail, Transaction, sequelize } from '../../database/index'
import { loadTypeLists } from '../catalog'
import { lockBill, readBillRole } from '../access'
import dayjs from 'dayjs'
import { Op, UniqueConstraintError, Transaction as DbTransaction } from 'sequelize'

interface BudgetDetailRow {
  id?: string
  costTypeId?: string | null
  costTypeName?: string | null
  budget?: number
  cost?: number
}

interface BudgetYearRow {
  id?: string
  date?: number | string | null
  totalBudget?: number
  currCost?: number
  details?: BudgetDetailRow[]
}

const round2 = (value: number) => Number(value.toFixed(2))

/** 把年度行和明细拼成对外返回的结构 */
const toYearRow = (budget: Row, details: Row[]): BudgetYearRow => {
  const plain = toPlain(budget)
  return {
    id: plain.id,
    date: plain.date,
    totalBudget: Number(plain.totalBudget),
    currCost: Number(plain.currCost),
    details: details.map((d: Row) => {
      const item = toPlain(d)
      return {
        id: item.id,
        costTypeId: item.costTypeId,
        costTypeName: item.costTypeName,
        budget: Number(item.budget),
        cost: Number(item.cost)
      }
    })
  }
}

/** 只读取本账本的预算。账本不存在时返回空数组，是否存在由调用方另查 */
export async function loadBudgets(billId: string | null | undefined, transaction?: DbTransaction | null): Promise<BudgetYearRow[]> {
  const budgets = await BillBudget.findAll({ where: { billId }, transaction })
  const budgetIds = budgets.map((b: Row) => b.id)
  let budgetDetails: Row[] = []
  if (budgetIds.length) {
    budgetDetails = await BillBudgetDetail.findAll({
      where: { budgetId: { [Op.in]: budgetIds } },
      transaction
    })
  }
  return budgets.map((b: Row) => {
    const details = budgetDetails.filter((d: Row) => d.budgetId === b.id)
    return toYearRow(b, details)
  })
}

/** 读取某一账本某一年的预算行与明细 */
const loadYearBudget = async (
  billId: string | null | undefined,
  year: number,
  transaction?: DbTransaction | null
): Promise<BudgetYearRow | null> => {
  const budget = await BillBudget.findOne({ where: { billId, date: year }, transaction })
  if (!budget) return null
  const details = await BillBudgetDetail.findAll({ where: { budgetId: budget.id }, transaction })
  return toYearRow(budget, details)
}

/** 统计某年未报销支出。传入支出类型时只统计该分类 */
export const sumCountedExpense = async (
  billId: string | null | undefined,
  year: number,
  costTypeId: unknown,
  transaction: DbTransaction
) => {
  const begin = dayjs(`${year}-01-01`).startOf('day').valueOf()
  const end = dayjs(`${year}-12-31`).endOf('day').valueOf()
  const where: WhereBag = {
    billId,
    type: 1,
    isDel: false,
    date: { [Op.between]: [begin, end] },
    [Op.or]: [{ reimbursement: 0 }, { reimbursement: null }]
  }
  if (costTypeId != null && costTypeId !== '') where.costTypeId = costTypeId
  const rows = await Transaction.findAll({
    where,
    attributes: ['money'],
    raw: true,
    transaction
  })
  return round2(rows.reduce((sum: number, row: Row) => sum + (Number(row.money) || 0), 0))
}

/** 给已有年度行的已用金额做增量。没有该年则返回 false */
const bumpExistingYearCost = async (
  billId: string,
  year: number,
  delta: number,
  transaction: DbTransaction
) => {
  const yearRow = await BillBudget.findOne({
    where: { billId, date: year },
    transaction,
    attributes: ['id']
  })
  if (!yearRow) return false
  await BillBudget.increment({ currCost: delta }, { where: { id: yearRow.id }, transaction })
  return true
}

/** 给已有分类明细的已用金额做增量。没有明细则跳过 */
const bumpExistingDetailCost = async (
  billId: string,
  year: number,
  costTypeId: unknown,
  delta: number,
  transaction: DbTransaction
) => {
  if (costTypeId == null || costTypeId === '') return
  const yearRow = await BillBudget.findOne({
    where: { billId, date: year },
    transaction,
    attributes: ['id']
  })
  if (!yearRow) return
  await BillBudgetDetail.increment(
    { cost: delta },
    { where: { budgetId: yearRow.id, costTypeId: String(costTypeId) }, transaction }
  )
}

/**
 * 在已锁账本的事务内，按带符号差额更新年度和分类已用。
 * 流水必须先落库；新建年度行时用该年全量未报销支出填初值。
 */
export async function applyBudgetDelta(
  billId: string | null | undefined,
  year: number,
  costTypeId: unknown,
  delta: number,
  transaction: DbTransaction
) {
  if (!billId || !Number.isFinite(year) || !Number.isInteger(year) || year < 1971 || year > 9999) return
  const amount = round2(delta)
  if (!amount) return

  const updated = await bumpExistingYearCost(billId, year, amount, transaction)
  if (updated) {
    await bumpExistingDetailCost(billId, year, costTypeId, amount, transaction)
    return
  }
  if (amount < 0) return

  const yearSpent = await sumCountedExpense(billId, year, null, transaction)
  try {
    await BillBudget.create(
      {
        billId,
        date: year,
        totalBudget: 0,
        currCost: yearSpent
      },
      { transaction }
    )
  } catch (err: unknown) {
    if (!(err instanceof UniqueConstraintError)) throw err
    await bumpExistingYearCost(billId, year, amount, transaction)
    await bumpExistingDetailCost(billId, year, costTypeId, amount, transaction)
  }
}

/**
 * 批量写入后按年份和「年份 + 分类」分别增量。
 * 同年多分类时，年度已用只加一次年份汇总。
 */
export async function applyBudgetBatchDeltas(
  billId: string | null | undefined,
  yearDeltas: Map<number, number>,
  typeDeltas: Map<string, number>,
  transaction: DbTransaction
) {
  if (!billId) return
  for (const [year, delta] of yearDeltas) {
    await applyBudgetDelta(billId, year, null, delta, transaction)
  }
  for (const [key, delta] of typeDeltas) {
    const sep = key.indexOf(':')
    if (sep < 0) continue
    const year = Number(key.slice(0, sep))
    const costTypeId = key.slice(sep + 1)
    if (!costTypeId || !Number.isFinite(year)) continue
    await bumpExistingDetailCost(billId, year, costTypeId, round2(delta), transaction)
  }
}

// 查询预算列表。先确认成员，再读取该年预算
export const getList = async (data: Row) => {
  data.date = Number(data.date)
  const role = await readBillRole(data.userId, data.billId)
  if (role.kind === 'invalid' || role.kind === 'not_found') return ['未找到账本', null]
  if (role.kind !== 'member') return ['该用户并未加入此账本', null]
  const res = (await loadYearBudget(data.billId, data.date)) || { totalBudget: 0, currCost: 0, details: [] }
  return [null, res]
}

// 新增预算
export const addBudget = async (data: Row) => {
  const year = Number(data.date)
  if (!Number.isInteger(year) || year < 1971 || year > 9999) return ['预算年份不正确', null]
  const money = round2(Number(data.money))
  if (!Number.isFinite(money) || money <= 0) return ['金额不正确', null]
  if ((await readBillRole(data.userId, data.billId)).kind !== 'member') return ['该用户并未加入此账本', null]
  const types = await loadTypeLists(data.billId)
  const costType = types.costTypes.find((item: { id?: string; name?: string }) => item.id === data.costTypeId)
  if (!costType) return ['支出类型不存在', null]

  const tx = await sequelize.transaction()
  try {
    const locked = await lockBill(data.billId, tx)
    if (!locked) {
      await tx.rollback()
      return ['未找到账本', null]
    }
    const yearRow = await BillBudget.findOne({ where: { billId: data.billId, date: year }, transaction: tx })
    const spent = await sumCountedExpense(data.billId, year, data.costTypeId, tx)
    if (yearRow) {
      const exists = await BillBudgetDetail.findOne({
        where: { budgetId: yearRow.id, costTypeId: data.costTypeId },
        transaction: tx
      })
      if (exists) {
        await tx.rollback()
        return ['已存在相关预算', null]
      }
      await BillBudget.increment({ totalBudget: money }, { where: { id: yearRow.id }, transaction: tx })
      await BillBudgetDetail.create(
        {
          budgetId: yearRow.id,
          costTypeId: data.costTypeId,
          costTypeName: costType.name,
          budget: money,
          cost: spent
        },
        { transaction: tx }
      )
    } else {
      const yearSpent = await sumCountedExpense(data.billId, year, null, tx)
      const created = await BillBudget.create(
        {
          billId: data.billId,
          date: year,
          totalBudget: money,
          currCost: yearSpent
        },
        { transaction: tx }
      )
      await BillBudgetDetail.create(
        {
          budgetId: created.id,
          costTypeId: data.costTypeId,
          costTypeName: costType.name,
          budget: money,
          cost: spent
        },
        { transaction: tx }
      )
    }
    await tx.commit()
    return [null, true]
  } catch (e: unknown) {
    await tx.rollback()
    console.error(e)
    return ['新增失败', null]
  }
}

// 修改预算
export const editBudget = async (data: Row) => {
  const money = round2(Number(data.money))
  if (!Number.isFinite(money) || money <= 0) return ['金额不正确', null]
  if ((await readBillRole(data.userId, data.billId)).kind !== 'member') return ['该用户并未加入此账本', null]
  const year = Number(data.date)
  const tx = await sequelize.transaction()
  try {
    const locked = await lockBill(data.billId, tx)
    if (!locked) {
      await tx.rollback()
      return ['未找到账本', null]
    }
    const yearRow = await BillBudget.findOne({ where: { billId: data.billId, date: year }, transaction: tx })
    if (!yearRow) {
      await tx.rollback()
      return ['不存在该年度预算', null]
    }
    const detail = await BillBudgetDetail.findOne({
      where: { id: data.id, budgetId: yearRow.id },
      transaction: tx
    })
    if (!detail) {
      await tx.rollback()
      return ['不存在相关预算', null]
    }
    const nextTotal = round2(Number(yearRow.totalBudget || 0) - Number(detail.budget || 0) + money)
    await BillBudget.update({ totalBudget: nextTotal }, { where: { id: yearRow.id }, transaction: tx })
    await BillBudgetDetail.update({ budget: money }, { where: { id: detail.id }, transaction: tx })
    await tx.commit()
    return [null, true]
  } catch (e: unknown) {
    await tx.rollback()
    console.error(e)
    return ['编辑失败', null]
  }
}

export const deleteBudget = async (data: Row) => {
  if ((await readBillRole(data.userId, data.billId)).kind !== 'member') return ['该用户并未加入此账本', null]
  const year = Number(data.date)
  const tx = await sequelize.transaction()
  try {
    const locked = await lockBill(data.billId, tx)
    if (!locked) {
      await tx.rollback()
      return ['未找到账本', null]
    }
    const yearRow = await BillBudget.findOne({ where: { billId: data.billId, date: year }, transaction: tx })
    if (!yearRow) {
      await tx.rollback()
      return ['不存在该年度预算', null]
    }
    const detail = await BillBudgetDetail.findOne({
      where: { id: data.id, budgetId: yearRow.id },
      transaction: tx
    })
    if (!detail) {
      await tx.rollback()
      return ['不存在相关预算', null]
    }
    const nextTotal = round2(Number(yearRow.totalBudget || 0) - Number(detail.budget || 0))
    await BillBudget.update({ totalBudget: nextTotal }, { where: { id: yearRow.id }, transaction: tx })
    await BillBudgetDetail.destroy({ where: { id: detail.id }, transaction: tx })
    await tx.commit()
    return [null, true]
  } catch (e: unknown) {
    await tx.rollback()
    console.error(e)
    return ['删除失败', null]
  }
}
