const { BillCostType, BillIncomeType, Bill, Transaction, BillBudget, BillBudgetDetail } = require('../../database/index')

/** 检查用户是否为账本创建者 */
const checkBillCreator = async (billId, userId) => {
  const bill = await Bill.findOne({ where: { id: billId, creator: userId, isDel: false } })
  return !!bill
}

// ==================== 支出类型 ====================

/** 新增支出类型 */
const createCostType = async ({ billId, name, userId }) => {
  try {
    if (!(await checkBillCreator(billId, userId))) {
      return ['只有账本创建者才能管理类型', null]
    }
    // 生成短 ID，避免与系统默认的数字 ID 冲突
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
    const res = await BillCostType.create({ id, billId, name, isDel: false })
    return [null, { id: res.id, name: res.name }]
  } catch (err) {
    console.error(err)
    return [err?.message || '新增支出类型失败', null]
  }
}

/** 编辑支出类型 */
const editCostType = async ({ id, billId, name, userId }) => {
  try {
    if (!(await checkBillCreator(billId, userId))) {
      return ['只有账本创建者才能管理类型', null]
    }
    const [affected] = await BillCostType.update({ name }, { where: { id, billId, isDel: false } })
    if (!affected) return ['找不到该类型', null]

    // 同步更新 transactions 表中的 costTypeName
    await Transaction.update({ costTypeName: name }, { where: { billId, costTypeId: id, isDel: false } })

    // 同步更新 budget_details 表中的 costTypeName
    const budgets = await BillBudget.findAll({ where: { billId } })
    const budgetIds = budgets.map(b => b.id)
    if (budgetIds.length) {
      await BillBudgetDetail.update({ costTypeName: name }, { where: { budgetId: budgetIds, costTypeId: id } })
    }

    return [null, true]
  } catch (err) {
    console.error(err)
    return [err?.message || '编辑支出类型失败', null]
  }
}

/** 删除支出类型（软删除） */
const deleteCostType = async ({ id, billId, userId }) => {
  try {
    if (!(await checkBillCreator(billId, userId))) {
      return ['只有账本创建者才能管理类型', null]
    }
    // 保护系统内置类型（ID < 1020 的为系统默认类型）
    if (!isNaN(Number(id)) && Number(id) < 1020) {
      return ['系统内置类型不可删除', null]
    }
    const [affected] = await BillCostType.update({ isDel: true }, { where: { id, billId, isDel: false } })
    if (!affected) return ['找不到该类型', null]
    return [null, true]
  } catch (err) {
    console.error(err)
    return [err?.message || '删除支出类型失败', null]
  }
}

// ==================== 收入类型 ====================

/** 新增收入类型 */
const createIncomeType = async ({ billId, name, userId }) => {
  try {
    if (!(await checkBillCreator(billId, userId))) {
      return ['只有账本创建者才能管理类型', null]
    }
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
    const res = await BillIncomeType.create({ id, billId, name, isDel: false })
    return [null, { id: res.id, name: res.name }]
  } catch (err) {
    console.error(err)
    return [err?.message || '新增收入类型失败', null]
  }
}

/** 编辑收入类型 */
const editIncomeType = async ({ id, billId, name, userId }) => {
  try {
    if (!(await checkBillCreator(billId, userId))) {
      return ['只有账本创建者才能管理类型', null]
    }
    const [affected] = await BillIncomeType.update({ name }, { where: { id, billId, isDel: false } })
    if (!affected) return ['找不到该类型', null]

    // 同步更新 transactions 表中的 incomesTypeName
    await Transaction.update({ incomesTypeName: name }, { where: { billId, incomesTypeId: id, isDel: false } })

    return [null, true]
  } catch (err) {
    console.error(err)
    return [err?.message || '编辑收入类型失败', null]
  }
}

/** 删除收入类型（软删除） */
const deleteIncomeType = async ({ id, billId, userId }) => {
  try {
    if (!(await checkBillCreator(billId, userId))) {
      return ['只有账本创建者才能管理类型', null]
    }
    // 保护系统内置类型（ID < 2008 的为系统默认收入类型）
    if (!isNaN(Number(id)) && Number(id) < 2008) {
      return ['系统内置类型不可删除', null]
    }
    const [affected] = await BillIncomeType.update({ isDel: true }, { where: { id, billId, isDel: false } })
    if (!affected) return ['找不到该类型', null]
    return [null, true]
  } catch (err) {
    console.error(err)
    return [err?.message || '删除收入类型失败', null]
  }
}

// ==================== 显隐切换 ====================

/** 切换支出类型显隐 */
const toggleCostTypeShow = async ({ id, billId, userId }) => {
  try {
    if (!(await checkBillCreator(billId, userId))) {
      return ['只有账本创建者才能管理类型', null]
    }
    const type = await BillCostType.findOne({ where: { id, billId, isDel: false } })
    if (!type) return ['找不到该类型', null]
    await BillCostType.update({ hidden: !type.hidden }, { where: { id, billId } })
    return [null, { hidden: !type.hidden }]
  } catch (err) {
    console.error(err)
    return [err?.message || '切换失败', null]
  }
}

/** 切换收入类型显隐 */
const toggleIncomeTypeShow = async ({ id, billId, userId }) => {
  try {
    if (!(await checkBillCreator(billId, userId))) {
      return ['只有账本创建者才能管理类型', null]
    }
    const type = await BillIncomeType.findOne({ where: { id, billId, isDel: false } })
    if (!type) return ['找不到该类型', null]
    await BillIncomeType.update({ hidden: !type.hidden }, { where: { id, billId } })
    return [null, { hidden: !type.hidden }]
  } catch (err) {
    console.error(err)
    return [err?.message || '切换失败', null]
  }
}

module.exports = {
  createCostType, editCostType, deleteCostType, toggleCostTypeShow,
  createIncomeType, editIncomeType, deleteIncomeType, toggleIncomeTypeShow
}
