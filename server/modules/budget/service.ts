import { toPlain, type Row, type WhereBag } from '../../types/domain'
import { Bill, BillBudget, BillBudgetDetail, Transaction, sequelize } from '../../database/index'
import { loadTypeLists } from '../catalog'
import { requireMember } from '../access'
import dayjs from 'dayjs'
import { Op, Transaction as DbTransaction } from 'sequelize'

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
    const plain = toPlain(b)
    const details = budgetDetails.filter((d: Row) => d.budgetId === b.id).map(toPlain)
    return {
      id: plain.id,
      date: plain.date,
      totalBudget: Number(plain.totalBudget),
      currCost: Number(plain.currCost),
      details: details.map((d: Row) => ({
        id: d.id,
        costTypeId: d.costTypeId,
        costTypeName: d.costTypeName,
        budget: Number(d.budget),
        cost: Number(d.cost)
      }))
    }
  })
}

/** 保存预算数组（整表替换式更新）。全仓库只保留这一套算法 */
export async function saveBudget(
  billId: string | null | undefined,
  budgetArray: BudgetYearRow[],
  transaction?: DbTransaction | null
) {
  const existing = await BillBudget.findAll({ where: { billId }, transaction })
  const existingIds = existing.map((b: Row) => b.id)
  if (existingIds.length) {
    await BillBudgetDetail.destroy({ where: { budgetId: { [Op.in]: existingIds } }, transaction })
    await BillBudget.destroy({ where: { billId }, transaction })
  }

  for (const item of budgetArray) {
    const budgetRow = await BillBudget.create(
      {
        id: item.id,
        billId,
        date: item.date,
        totalBudget: item.totalBudget,
        currCost: item.currCost
      },
      { transaction }
    )
    if (item.details && item.details.length) {
      await BillBudgetDetail.bulkCreate(
        item.details.map((d) => ({
          id: d.id,
          budgetId: budgetRow.id,
          costTypeId: d.costTypeId,
          costTypeName: d.costTypeName,
          budget: d.budget,
          cost: d.cost
        })),
        { transaction }
      )
    }
  }
}

/** 锁住账本行，让并发的记账和预算修改串行执行 */
export async function lockBill(billId: string | null | undefined, transaction: DbTransaction) {
  if (!billId) return null
  const bill = await Bill.findByPk(billId, { transaction, lock: transaction.LOCK.UPDATE })
  if (!bill || bill.isDel) return null
  return bill
}

/** 统计某年未报销支出。传入支出类型时只统计该分类 */
const sumCountedExpense = async (
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
  return rows.reduce((sum: number, row: Row) => sum + (Number(row.money) || 0), 0)
}

/** 预算接口需要的账本切片：预算行和支出类型名称 */
const loadBudgetContext = async (billId: string | null | undefined) => {
  const bill = await Bill.findByPk(billId)
  if (!bill) return null
  const [budget, types] = await Promise.all([loadBudgets(billId), loadTypeLists(billId)])
  return { budget, costTypes: types.costTypes }
}

// 查询预算列表
export const getList = async (data: Row) => {
  data.date = Number(data.date)
  const findBill = await loadBudgetContext(data.billId)
  if (!findBill) return ['未找到账本', null]
  if (!(await requireMember(data.userId, data.billId)).ok) return ['该用户并未加入此账本', null]
  const res = findBill.budget.find((item) => item.date === data.date) || { totalBudget: 0, currCost: 0, details: [] }
  if (res) return [null, res]
  else return ['查询失败', null]
}

// 新增预算
export const addBudget = async (data: Row) => {
  const year = Number(data.date)
  if (!Number.isInteger(year) || year < 1971 || year > 9999) return ['预算年份不正确', null]
  const money = Number(data.money)
  if (!Number.isFinite(money) || money <= 0) return ['金额不正确', null]
  if (!(await requireMember(data.userId, data.billId)).ok) return ['该用户并未加入此账本', null]
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
    const budgets = await loadBudgets(data.billId, tx)
    const spent = await sumCountedExpense(data.billId, year, data.costTypeId, tx)
    let budget = budgets.find((item) => Number(item.date) === year)
    if (budget) {
      const details = budget.details || []
      if (details.find((item) => item.costTypeId === data.costTypeId)) {
        await tx.rollback()
        return ['已存在相关预算', null]
      }
      budget.totalBudget = Number(budget.totalBudget || 0) + money
      details.push({
        costTypeId: data.costTypeId,
        costTypeName: costType.name,
        budget: money,
        cost: spent
      })
      budget.details = details
    } else {
      const yearSpent = await sumCountedExpense(data.billId, year, null, tx)
      budgets.push({
        date: year,
        totalBudget: money,
        currCost: yearSpent,
        details: [
          {
            costTypeId: data.costTypeId,
            costTypeName: costType.name,
            budget: money,
            cost: spent
          }
        ]
      })
    }
    await saveBudget(data.billId, budgets, tx)
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
  const money = Number(data.money)
  if (!Number.isFinite(money) || money <= 0) return ['金额不正确', null]
  if (!(await requireMember(data.userId, data.billId)).ok) return ['该用户并未加入此账本', null]
  const tx = await sequelize.transaction()
  try {
    const locked = await lockBill(data.billId, tx)
    if (!locked) {
      await tx.rollback()
      return ['未找到账本', null]
    }
    const budgets = await loadBudgets(data.billId, tx)
    const budget = budgets.find((item) => Number(item.date) === Number(data.date))
    if (!budget) {
      await tx.rollback()
      return ['不存在该年度预算', null]
    }
    const budgetDetailItem = (budget.details || []).find((item) => item.id === data.id)
    if (!budgetDetailItem) {
      await tx.rollback()
      return ['不存在相关预算', null]
    }
    budget.totalBudget = Number(budget.totalBudget || 0) - Number(budgetDetailItem.budget || 0) + money
    budgetDetailItem.budget = money
    await saveBudget(data.billId, budgets, tx)
    await tx.commit()
    return [null, true]
  } catch (e: unknown) {
    await tx.rollback()
    console.error(e)
    return ['编辑失败', null]
  }
}

export const deleteBudget = async (data: Row) => {
  if (!(await requireMember(data.userId, data.billId)).ok) return ['该用户并未加入此账本', null]
  const tx = await sequelize.transaction()
  try {
    const locked = await lockBill(data.billId, tx)
    if (!locked) {
      await tx.rollback()
      return ['未找到账本', null]
    }
    const budgets = await loadBudgets(data.billId, tx)
    const budget = budgets.find((item) => Number(item.date) === Number(data.date))
    if (!budget) {
      await tx.rollback()
      return ['不存在该年度预算', null]
    }
    const budgetDetailItem = (budget.details || []).find((item) => item.id === data.id)
    if (!budgetDetailItem) {
      await tx.rollback()
      return ['不存在相关预算', null]
    }
    budget.totalBudget = Number(budget.totalBudget || 0) - Number(budgetDetailItem.budget || 0)
    budget.details = (budget.details || []).filter((item) => item.id !== data.id)
    await saveBudget(data.billId, budgets, tx)
    await tx.commit()
    return [null, true]
  } catch (e: unknown) {
    await tx.rollback()
    console.error(e)
    return ['删除失败', null]
  }
}
