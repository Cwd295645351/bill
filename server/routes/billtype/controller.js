const { BillCostType, BillIncomeType, Bill, BillOverviewRule, Transaction, BillBudget, BillBudgetDetail } = require('../../database/index')
const { formatOverviewRule, RULE_TYPE_QUANTITY, RULE_TYPE_COST_TYPE } = require('../../database/services/billService')

const RULE_TYPES = [RULE_TYPE_QUANTITY, RULE_TYPE_COST_TYPE]

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

// ==================== 概览调整规则 ====================

/** 校验规则字段，通过则返回规范化后的 payload */
const validateOverviewRulePayload = async ({ billId, name, ruleType, unitName, unitPrice, costTypeId, excludeId }) => {
  const trimmedName = (name || '').trim()
  if (!trimmedName) return ['规则名称不能为空', null]
  if (!RULE_TYPES.includes(ruleType)) return ['不支持的规则类型', null]

  const payload = {
    name: trimmedName,
    ruleType,
    unitName: null,
    unitPrice: 0,
    costTypeId: null
  }

  if (ruleType === RULE_TYPE_QUANTITY) {
    const trimmedUnit = (unitName || '').trim()
    const price = Number(unitPrice)
    if (!trimmedUnit) return ['单位名称不能为空', null]
    if (!Number.isFinite(price) || price <= 0) return ['单价必须为正数', null]
    payload.unitName = trimmedUnit
    payload.unitPrice = price
    return [null, payload]
  }

  const typeId = (costTypeId || '').trim()
  if (!typeId) return ['请选择支出类型', null]
  const costType = await BillCostType.findOne({ where: { id: typeId, billId, isDel: false } })
  if (!costType) return ['支出类型不存在或不属于该账本', null]

  const where = { billId, ruleType: RULE_TYPE_COST_TYPE, costTypeId: typeId }
  const duplicated = await BillOverviewRule.findOne({ where })
  if (duplicated && duplicated.id !== excludeId) {
    return ['该支出类型已关联调整规则', null]
  }

  payload.costTypeId = typeId
  payload.name = trimmedName || costType.name
  return [null, payload]
}

/** 新增概览规则 */
const createOverviewRule = async ({ billId, name, ruleType, unitName, unitPrice, costTypeId, userId }) => {
  try {
    if (!(await checkBillCreator(billId, userId))) {
      return ['只有账本创建者才能管理概览规则', null]
    }
    const [err, payload] = await validateOverviewRulePayload({ billId, name, ruleType, unitName, unitPrice, costTypeId })
    if (err) return [err, null]

    const maxSort = await BillOverviewRule.max('sort', { where: { billId } })
    const res = await BillOverviewRule.create({
      ...payload,
      billId,
      enabled: true,
      sort: Number.isFinite(maxSort) ? maxSort + 1 : 0
    })
    return [null, formatOverviewRule(res)]
  } catch (err) {
    console.error(err)
    return [err?.message || '新增概览规则失败', null]
  }
}

/** 编辑概览规则 */
const editOverviewRule = async ({ id, billId, name, ruleType, unitName, unitPrice, costTypeId, userId }) => {
  try {
    if (!(await checkBillCreator(billId, userId))) {
      return ['只有账本创建者才能管理概览规则', null]
    }
    const rule = await BillOverviewRule.findOne({ where: { id, billId } })
    if (!rule) return ['找不到该规则', null]

    const [err, payload] = await validateOverviewRulePayload({
      billId,
      name,
      ruleType,
      unitName,
      unitPrice,
      costTypeId,
      excludeId: id
    })
    if (err) return [err, null]

    await BillOverviewRule.update(payload, { where: { id, billId } })
    const updated = await BillOverviewRule.findOne({ where: { id, billId } })
    return [null, formatOverviewRule(updated)]
  } catch (err) {
    console.error(err)
    return [err?.message || '编辑概览规则失败', null]
  }
}

/** 切换概览规则启停 */
const toggleOverviewRule = async ({ id, billId, userId }) => {
  try {
    if (!(await checkBillCreator(billId, userId))) {
      return ['只有账本创建者才能管理概览规则', null]
    }
    const rule = await BillOverviewRule.findOne({ where: { id, billId } })
    if (!rule) return ['找不到该规则', null]
    await BillOverviewRule.update({ enabled: !rule.enabled }, { where: { id, billId } })
    return [null, { enabled: !rule.enabled }]
  } catch (err) {
    console.error(err)
    return [err?.message || '切换失败', null]
  }
}

/** 删除概览规则 */
const deleteOverviewRule = async ({ id, billId, userId }) => {
  try {
    if (!(await checkBillCreator(billId, userId))) {
      return ['只有账本创建者才能管理概览规则', null]
    }
    const rule = await BillOverviewRule.findOne({ where: { id, billId } })
    if (!rule) return ['找不到该规则', null]
    await BillOverviewRule.destroy({ where: { id, billId } })
    return [null, true]
  } catch (err) {
    console.error(err)
    return [err?.message || '删除概览规则失败', null]
  }
}

module.exports = {
  createCostType, editCostType, deleteCostType, toggleCostTypeShow,
  createIncomeType, editIncomeType, deleteIncomeType, toggleIncomeTypeShow,
  createOverviewRule, editOverviewRule, toggleOverviewRule, deleteOverviewRule
}
