const {
  Bill,
  BillUser,
  BillCostType,
  BillIncomeType,
  BillPayMethod,
  BillPlanBuy,
  BillBudget,
  BillBudgetDetail,
  sequelize
} = require('../index')
const { Op } = require('sequelize')

/** 将 Sequelize 实例转为普通对象 */
const toPlain = (row) => (row && row.get ? row.get({ plain: true }) : row)

/** 组装账本详情结构 */
const formatBillDetail = (bill, relations) => {
  const plain = toPlain(bill)
  return {
    id: plain.id,
    name: plain.name,
    creator: plain.creator,
    isDel: plain.isDel,
    users: (relations.users || []).map((u) => ({ id: u.userId, name: u.userName })),
    costTypes: (relations.costTypes || []).map((c) => ({
      id: c.id,
      name: c.name,
      isDel: c.isDel,
      hidden: c.hidden
    })),
    incomesTypes: (relations.incomesTypes || []).map((c) => ({
      id: c.id,
      name: c.name,
      isDel: c.isDel,
      hidden: c.hidden
    })),
    payMethods: (relations.payMethods || []).map((c) => ({
      id: c.id,
      name: c.name,
      isDel: c.isDel
    })),
    planBuy: {
      count: plain.planBuyCount || 0,
      details: (relations.planBuyDetails || []).map((p) => ({
        id: p.id,
        title: p.title,
        context: p.context,
        priority: p.priority,
        isBuy: p.isBuy,
        isDel: p.isDel
      }))
    },
    budget: (relations.budgets || []).map((b) => ({
      id: b.id,
      date: b.date,
      totalBudget: Number(b.totalBudget),
      currCost: Number(b.currCost),
      details: (b.details || []).map((d) => ({
        id: d.id,
        costTypeId: d.costTypeId,
        costTypeName: d.costTypeName,
        budget: Number(d.budget),
        cost: Number(d.cost)
      }))
    }))
  }
}

/** 按 id 查询账本并组装嵌套结构 */
const findBillById = async (billId, options = {}) => {
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

  const budgetIds = budgets.map((b) => b.id)
  let budgetDetails = []
  if (budgetIds.length) {
    budgetDetails = await BillBudgetDetail.findAll({
      where: { budgetId: { [Op.in]: budgetIds } },
      transaction
    })
  }

  const budgetsWithDetails = budgets.map((b) => {
    const plain = toPlain(b)
    plain.details = budgetDetails.filter((d) => d.budgetId === b.id).map(toPlain)
    return plain
  })

  return formatBillDetail(bill, {
    users: users.map(toPlain),
    costTypes: costTypes.map(toPlain),
    incomesTypes: incomesTypes.map(toPlain),
    payMethods: payMethods.map(toPlain),
    planBuyDetails: planBuyDetails.map(toPlain),
    budgets: budgetsWithDetails
  })
}

/** 保存预算数组（整表替换式更新） */
const saveBudget = async (billId, budgetArray, transaction) => {
  const existing = await BillBudget.findAll({ where: { billId }, transaction })
  const existingIds = existing.map((b) => b.id)
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
const savePlanBuy = async (billId, planBuy, transaction) => {
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

module.exports = {
  toPlain,
  formatBillDetail,
  findBillById,
  saveBudget,
  savePlanBuy,
  sequelize
}
