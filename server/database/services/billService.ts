import type { Row } from '../../types/domain'
import { Bill, BillUser, BillCostType, BillIncomeType, BillPayMethod, BillOverviewRule, BillPlanBuy, BillBudget, BillBudgetDetail, sequelize } from '../index'
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

/** 数量 × 单价扣减 */
const RULE_TYPE_QUANTITY = 'quantity'
/** 指定支出类型扣减 */
const RULE_TYPE_COST_TYPE = 'cost_type'

/** 将 Sequelize 实例转为普通对象 */
const toPlain = (row: Row): Row => (row && row.get ? row.get({ plain: true }) || row : row)

/** 组装账本详情结构 */
const formatBillDetail = (bill: Row, relations: Row): {
  id?: string
  name?: string
  creator?: string
  isDel?: boolean
  users: Row[]
  costTypes: Row[]
  incomesTypes: Row[]
  payMethods: Row[]
  overviewRules: Row[]
  planBuy: { count: number; details: Row[] }
  budget: BudgetYearRow[]
} => {
  const plain = toPlain(bill)
  return {
    id: plain.id,
    name: plain.name,
    creator: plain.creator,
    isDel: plain.isDel,
    users: (relations.users || []).map((u: Row) => ({ id: u.userId, name: u.userName })),
    costTypes: (relations.costTypes || []).map((c: Row) => ({
      id: c.id,
      name: c.name,
      isDel: c.isDel,
      hidden: c.hidden
    })),
    incomesTypes: (relations.incomesTypes || []).map((c: Row) => ({
      id: c.id,
      name: c.name,
      isDel: c.isDel,
      hidden: c.hidden
    })),
    payMethods: (relations.payMethods || []).map((c: Row) => ({
      id: c.id,
      name: c.name,
      isDel: c.isDel
    })),
    overviewRules: (relations.overviewRules || []).map(formatOverviewRule),
    planBuy: {
      count: plain.planBuyCount || 0,
      details: (relations.planBuyDetails || []).map((p: Row) => ({
        id: p.id,
        title: p.title,
        context: p.context,
        priority: p.priority,
        isBuy: p.isBuy,
        isDel: p.isDel
      }))
    },
    budget: (relations.budgets || []).map((b: Row) => ({
      id: b.id,
      date: b.date,
      totalBudget: Number(b.totalBudget),
      currCost: Number(b.currCost),
      details: (b.details || []).map((d: Row) => ({
        id: d.id,
        costTypeId: d.costTypeId,
        costTypeName: d.costTypeName,
        budget: Number(d.budget),
        cost: Number(d.cost)
      }))
    }))
  }
}

/** 将规则行格式化为前端可用结构 */
const formatOverviewRule = (row: Row) => {
  const plain = toPlain(row)
  return {
    id: plain.id,
    name: plain.name,
    ruleType: plain.ruleType,
    enabled: !!plain.enabled,
    unitName: plain.unitName || '',
    unitPrice: Number(plain.unitPrice || 0),
    costTypeId: plain.costTypeId || '',
    sort: Number(plain.sort || 0)
  }
}

/** 按 id 查询账本并组装嵌套结构 */
const findBillById = async (billId: string | null | undefined, options: { transaction?: DbTransaction | null } = {}) => {
  const { transaction } = options
  const bill = await Bill.findByPk(billId, { transaction })
  if (!bill) return null

  const [users, costTypes, incomesTypes, payMethods, planBuyDetails, budgets] = await Promise.all([
    BillUser.findAll({ where: { billId }, transaction }),
    BillCostType.findAll({ where: { billId, isDel: false }, transaction }),
    BillIncomeType.findAll({ where: { billId, isDel: false }, transaction }),
    BillPayMethod.findAll({ where: { billId, isDel: false }, transaction }),
    BillPlanBuy.findAll({ where: { billId }, transaction }),
    BillBudget.findAll({ where: { billId }, transaction })
  ])

  const overviewRules = await BillOverviewRule.findAll({
    where: { billId },
    order: [
      ['sort', 'ASC'],
      ['name', 'ASC']
    ],
    transaction
  })

  const budgetIds = budgets.map((b: Row) => b.id)
  let budgetDetails: Row[] = []
  if (budgetIds.length) {
    budgetDetails = await BillBudgetDetail.findAll({
      where: { budgetId: { [Op.in]: budgetIds } },
      transaction
    })
  }

  const budgetsWithDetails = budgets.map((b: Row) => {
    const plain = toPlain(b)
    plain.details = budgetDetails.filter((d: Row) => d.budgetId === b.id).map(toPlain)
    return plain
  })

  return formatBillDetail(bill, {
    users: users.map(toPlain),
    costTypes: costTypes.map(toPlain),
    incomesTypes: incomesTypes.map(toPlain),
    payMethods: payMethods.map(toPlain),
    overviewRules: overviewRules.map(toPlain),
    planBuyDetails: planBuyDetails.map(toPlain),
    budgets: budgetsWithDetails
  })
}

/** 保存预算数组（整表替换式更新） */
const saveBudget = async (
  billId: string | null | undefined,
  budgetArray: BudgetYearRow[],
  transaction?: DbTransaction | null
) => {
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

/** 保存 planBuy 结构 */
const savePlanBuy = async (
  billId: string | null | undefined,
  planBuy: { count?: number; details?: Row[] },
  transaction?: unknown
) => {
  await BillPlanBuy.destroy({ where: { billId }, transaction })
  if (planBuy.details && planBuy.details.length) {
    await BillPlanBuy.bulkCreate(
      planBuy.details.map((d) => ({
        id: d.id,
        billId,
        title: d.title,
        context: d.context,
        priority: d.priority,
        isBuy: d.isBuy || false,
        isDel: d.isDel || false
      })),
      { transaction }
    )
  }
  await Bill.update({ planBuyCount: planBuy.count || 0 }, { where: { id: billId }, transaction })
}

export { toPlain, formatBillDetail, formatOverviewRule, findBillById, RULE_TYPE_QUANTITY, RULE_TYPE_COST_TYPE, saveBudget, savePlanBuy, sequelize }
