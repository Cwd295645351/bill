import type { Row, WhereBag } from '../../types/domain'
import { Bill, BillBudget, BillBudgetDetail, Transaction, sequelize } from '../../database/index'
import { loadTypeLists } from '../catalog'
import { requireMember } from '../access'
import dayjs from 'dayjs'
import { Op } from 'sequelize'
import type { Transaction as DbTransaction } from 'sequelize'

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

/** 将模型实例转成普通对象 */
const toPlain = (row: Row): Row => (row && row.get ? row.get({ plain: true }) || row : row)

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
  data.money = Number(data.money)
  const findBill = await loadBudgetContext(data.billId)
  if (!findBill) return ['未找到账本', null]
  if (!(await requireMember(data.userId, data.billId)).ok) return ['该用户并未加入此账本', null]

  let budget = findBill.budget.find((item) => item.date === data.date)
  if (budget) {
    // 已存在年度预算
    const details = budget.details || []
    let budgetDetailItem = details.find((item) => item.costTypeId === data.costTypeId)
    if (budgetDetailItem) return ['已存在相关预算', null]
    budget.totalBudget = Number(budget.totalBudget || 0) + Number(data.money)
    budgetDetailItem = {
      costTypeId: data.costTypeId,
      costTypeName: findBill.costTypes.find((item: { id?: string; name?: string }) => item.id === data.costTypeId)!.name,
      budget: data.money,
      cost: 0
    }
    // 查找当前年度该支出类型支出的金额
    const params: WhereBag = {
      billId: data.billId,
      type: 1,
      costTypeId: data.costTypeId,
      date: {
        [Op.between]: [dayjs().startOf('year').valueOf(), dayjs().endOf('year').valueOf()]
      },
      isDel: false
    }
    const res = await Transaction.findAll({ where: params, attributes: ['money'], raw: true })
    budgetDetailItem.cost = res.reduce((prev: number, curr: Row) => {
      return prev + Number(curr.money)
    }, 0)
    details.push(budgetDetailItem)
    budget.details = details
  } else {
    // 未存在当前年度预算。挂到完整列表上，保存时按整表替换，不能只提交这一年
    findBill.budget.push({
      date: data.date,
      totalBudget: data.money,
      currCost: 0,
      details: [
        {
          costTypeId: data.costTypeId,
          costTypeName: findBill.costTypes.find((item: { id?: string; name?: string }) => item.id === data.costTypeId)!.name,
          budget: data.money,
          cost: 0
        }
      ]
    })
  }
  const tx = await sequelize.transaction()
  try {
    await saveBudget(data.billId, findBill.budget, tx)
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
  data.money = Number(data.money)
  const findBill = await loadBudgetContext(data.billId)
  if (!findBill) return ['未找到账本', null]
  if (!(await requireMember(data.userId, data.billId)).ok) return ['该用户并未加入此账本', null]
  let budget = findBill.budget.find((item) => item.date === data.date)
  if (!budget) return ['不存在该年度预算', null]
  // 查找预算明细
  let budgetDetailItem = (budget.details || []).find((item: { id?: string; name?: string }) => item.id === data.id)
  if (!budgetDetailItem) return ['不存在相关预算', null]
  budget.totalBudget = Number(budget.totalBudget || 0) - Number(budgetDetailItem.budget || 0) + Number(data.money) // 计算总预算
  budgetDetailItem.budget = data.money // 设置分项预算
  const tx = await sequelize.transaction()
  try {
    await saveBudget(data.billId, findBill.budget, tx)
    await tx.commit()
    return [null, true]
  } catch (e: unknown) {
    await tx.rollback()
    console.error(e)
    return ['编辑失败', null]
  }
}

export const deleteBudget = async (data: Row) => {
  data.date = Number(data.date)
  const findBill = await loadBudgetContext(data.billId)
  if (!findBill) return ['未找到账本', null]
  if (!(await requireMember(data.userId, data.billId)).ok) return ['该用户并未加入此账本', null]
  let budget = findBill.budget.find((item) => item.date === data.date)
  if (!budget) return ['不存在该年度预算', null]
  // 查找预算明细
  const budgetDetailItem = (budget.details || []).find((item: { id?: string; name?: string }) => item.id === data.id)
  if (!budgetDetailItem) return ['不存在相关预算', null]
  budget.totalBudget = Number(budget.totalBudget || 0) - Number(budgetDetailItem.budget || 0)
  budget.details = (budget.details || []).filter((item: { id?: string; name?: string }) => item.id !== data.id)
  const tx = await sequelize.transaction()
  try {
    await saveBudget(data.billId, findBill.budget, tx)
    await tx.commit()
    return [null, true]
  } catch (e: unknown) {
    await tx.rollback()
    console.error(e)
    return ['删除失败', null]
  }
}
