import { toPlain, type Row, type WhereBag } from '../../types/domain'
import { BillCostType, BillIncomeType, BillPayMethod, BillOverviewRule, BillOverviewRuleYear, Transaction, BillBudget, BillBudgetDetail, sequelize } from '../../database/index'
import { listMembers } from '../bill'
import type { Transaction as DbTransaction } from 'sequelize'
import { requireCreator, requireMember } from '../access'

/** 数量 × 单价扣减 */
const RULE_TYPE_QUANTITY = 'quantity'
/** 指定支出类型扣减 */
const RULE_TYPE_COST_TYPE = 'cost_type'

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

/** 读取本账本未删除的支出、收入、支付方式。供记账和账本详情使用 */
export async function loadTypeLists(billId: string | null | undefined, transaction?: DbTransaction | null) {
  const [costTypes, incomesTypes, payMethods] = await Promise.all([
    BillCostType.findAll({ where: { billId, isDel: false }, transaction }),
    BillIncomeType.findAll({ where: { billId, isDel: false }, transaction }),
    BillPayMethod.findAll({ where: { billId, isDel: false }, transaction })
  ])
  return {
    costTypes: costTypes.map((c: Row) => {
      const plain = toPlain(c)
      return { id: plain.id as string | undefined, name: plain.name as string | undefined, isDel: plain.isDel, hidden: plain.hidden }
    }),
    incomesTypes: incomesTypes.map((c: Row) => {
      const plain = toPlain(c)
      return { id: plain.id as string | undefined, name: plain.name as string | undefined, isDel: plain.isDel, hidden: plain.hidden }
    }),
    payMethods: payMethods.map((c: Row) => {
      const plain = toPlain(c)
      return { id: plain.id as string | undefined, name: plain.name as string | undefined, isDel: plain.isDel }
    })
  }
}

/** 读取本账本的概览规则，排序与原来的详情一致 */
export async function loadOverviewRules(billId: string | null | undefined, transaction?: DbTransaction | null) {
  const overviewRules = await BillOverviewRule.findAll({
    where: { billId },
    order: [
      ['sort', 'ASC'],
      ['name', 'ASC']
    ],
    transaction
  })
  return overviewRules.map((row: Row) => formatOverviewRule(row))
}

const RULE_TYPES = [RULE_TYPE_QUANTITY, RULE_TYPE_COST_TYPE]

/** 检查用户是否为账本创建者 */
const checkBillCreator = async (billId: string | null | undefined, userId: string | null | undefined) => {
  const access = await requireCreator(userId, billId)
  return access.ok
}

/** 检查用户是否为账本成员 */
const checkBillMember = async (billId: string | null | undefined, userId: string | null | undefined) => {
  const access = await requireMember(userId, billId)
  return access.ok
}

// ==================== 支出类型 ====================

/** 新增支出类型 */
const createCostType = async ({ billId, name, userId }: Row) => {
  try {
    if (!(await checkBillCreator(billId, userId))) {
      return ['只有账本创建者才能管理类型', null]
    }
    // 生成短 ID，避免与系统默认的数字 ID 冲突
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
    const res = await BillCostType.create({ id, billId, name, isDel: false })
    return [null, { id: res.id, name: res.name }]
  } catch (err: unknown) {
    console.error(err)
    return [(err instanceof Error ? err.message : '') || '新增支出类型失败', null]
  }
}

/** 编辑支出类型 */
const editCostType = async ({ id, billId, name, userId }: Row) => {
  if (!(await checkBillCreator(billId, userId))) {
    return ['只有账本创建者才能管理类型', null]
  }
  const tx = await sequelize.transaction()
  try {
    const { lockBill } = await import('../budget')
    const locked = await lockBill(billId, tx)
    if (!locked) {
      await tx.rollback()
      return ['未找到账本', null]
    }
    const current = await BillCostType.findOne({ where: { id, billId, isDel: false }, transaction: tx })
    if (!current) {
      await tx.rollback()
      return ['找不到该类型', null]
    }
    if (String(current.name || '') !== name) {
      await BillCostType.update({ name }, { where: { id, billId, isDel: false }, transaction: tx })
    }
    await Transaction.update({ costTypeName: name }, { where: { billId, costTypeId: id, isDel: false }, transaction: tx })
    const budgets = await BillBudget.findAll({ where: { billId }, transaction: tx })
    const budgetIds = budgets.map((b: Row) => b.id)
    if (budgetIds.length) {
      await BillBudgetDetail.update(
        { costTypeName: name },
        { where: { budgetId: budgetIds, costTypeId: id }, transaction: tx }
      )
    }
    await tx.commit()
    return [null, true]
  } catch (err: unknown) {
    await tx.rollback()
    console.error(err)
    return [(err instanceof Error ? err.message : '') || '编辑支出类型失败', null]
  }
}

/** 删除支出类型（软删除） */
const deleteCostType = async ({ id, billId, userId }: Row) => {
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
  } catch (err: unknown) {
    console.error(err)
    return [(err instanceof Error ? err.message : '') || '删除支出类型失败', null]
  }
}

// ==================== 收入类型 ====================

/** 新增收入类型 */
const createIncomeType = async ({ billId, name, userId }: Row) => {
  try {
    if (!(await checkBillCreator(billId, userId))) {
      return ['只有账本创建者才能管理类型', null]
    }
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
    const res = await BillIncomeType.create({ id, billId, name, isDel: false })
    return [null, { id: res.id, name: res.name }]
  } catch (err: unknown) {
    console.error(err)
    return [(err instanceof Error ? err.message : '') || '新增收入类型失败', null]
  }
}

/** 编辑收入类型 */
const editIncomeType = async ({ id, billId, name, userId }: Row) => {
  if (!(await checkBillCreator(billId, userId))) {
    return ['只有账本创建者才能管理类型', null]
  }
  const tx = await sequelize.transaction()
  try {
    const { lockBill } = await import('../budget')
    const locked = await lockBill(billId, tx)
    if (!locked) {
      await tx.rollback()
      return ['未找到账本', null]
    }
    const current = await BillIncomeType.findOne({ where: { id, billId, isDel: false }, transaction: tx })
    if (!current) {
      await tx.rollback()
      return ['找不到该类型', null]
    }
    if (String(current.name || '') !== name) {
      await BillIncomeType.update({ name }, { where: { id, billId, isDel: false }, transaction: tx })
    }
    await Transaction.update({ incomesTypeName: name }, { where: { billId, incomesTypeId: id, isDel: false }, transaction: tx })
    await tx.commit()
    return [null, true]
  } catch (err: unknown) {
    await tx.rollback()
    console.error(err)
    return [(err instanceof Error ? err.message : '') || '编辑收入类型失败', null]
  }
}

/** 删除收入类型（软删除） */
const deleteIncomeType = async ({ id, billId, userId }: Row) => {
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
  } catch (err: unknown) {
    console.error(err)
    return [(err instanceof Error ? err.message : '') || '删除收入类型失败', null]
  }
}

// ==================== 显隐切换 ====================

/** 切换支出类型显隐 */
const toggleCostTypeShow = async ({ id, billId, userId }: Row) => {
  try {
    if (!(await checkBillCreator(billId, userId))) {
      return ['只有账本创建者才能管理类型', null]
    }
    const type = await BillCostType.findOne({ where: { id, billId, isDel: false } })
    if (!type) return ['找不到该类型', null]
    await BillCostType.update({ hidden: !type.hidden }, { where: { id, billId } })
    return [null, { hidden: !type.hidden }]
  } catch (err: unknown) {
    console.error(err)
    return [(err instanceof Error ? err.message : '') || '切换失败', null]
  }
}

/** 切换收入类型显隐 */
const toggleIncomeTypeShow = async ({ id, billId, userId }: Row) => {
  try {
    if (!(await checkBillCreator(billId, userId))) {
      return ['只有账本创建者才能管理类型', null]
    }
    const type = await BillIncomeType.findOne({ where: { id, billId, isDel: false } })
    if (!type) return ['找不到该类型', null]
    await BillIncomeType.update({ hidden: !type.hidden }, { where: { id, billId } })
    return [null, { hidden: !type.hidden }]
  } catch (err: unknown) {
    console.error(err)
    return [(err instanceof Error ? err.message : '') || '切换失败', null]
  }
}

// ==================== 概览调整规则 ====================

/** 校验规则字段，通过则返回规范化后的 payload */
const validateOverviewRulePayload = async ({ billId, name, ruleType, unitName, unitPrice, costTypeId, excludeId }: Row) => {
  const trimmedName = (name || '').trim()
  if (!trimmedName) return ['规则名称不能为空', null]
  if (!ruleType || !RULE_TYPES.includes(ruleType)) return ['不支持的规则类型', null]

  const payload: Row = {
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

  const where: WhereBag = { billId, ruleType: RULE_TYPE_COST_TYPE, costTypeId: typeId }
  const duplicated = await BillOverviewRule.findOne({ where })
  if (duplicated && duplicated.id !== excludeId) {
    return ['该支出类型已关联调整规则', null]
  }

  payload.costTypeId = typeId
  payload.name = trimmedName || costType.name
  return [null, payload]
}

/** 新增概览规则 */
const createOverviewRule = async ({ billId, name, ruleType, unitName, unitPrice, costTypeId, userId }: Row) => {
  try {
    if (!(await checkBillCreator(billId, userId))) {
      return ['只有账本创建者才能管理概览规则', null]
    }
    const [err, payload] = await validateOverviewRulePayload({ billId, name, ruleType, unitName, unitPrice, costTypeId })
    if (err || !payload || typeof payload !== 'object') return [err, null]

    const maxSort = await BillOverviewRule.max('sort', { where: { billId } })
    const res = await BillOverviewRule.create({
      ...payload,
      billId,
      enabled: true,
      sort: Number.isFinite(maxSort) ? maxSort + 1 : 0
    })
    return [null, formatOverviewRule(res)]
  } catch (err: unknown) {
    console.error(err)
    return [(err instanceof Error ? err.message : '') || '新增概览规则失败', null]
  }
}

/** 编辑概览规则 */
const editOverviewRule = async ({ id, billId, name, ruleType, unitName, unitPrice, costTypeId, userId }: Row) => {
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
  } catch (err: unknown) {
    console.error(err)
    return [(err instanceof Error ? err.message : '') || '编辑概览规则失败', null]
  }
}

/** 切换概览规则启停 */
const toggleOverviewRule = async ({ id, billId, userId }: Row) => {
  try {
    if (!(await checkBillCreator(billId, userId))) {
      return ['只有账本创建者才能管理概览规则', null]
    }
    const rule = await BillOverviewRule.findOne({ where: { id, billId } })
    if (!rule) return ['找不到该规则', null]
    await BillOverviewRule.update({ enabled: !rule.enabled }, { where: { id, billId } })
    return [null, { enabled: !rule.enabled }]
  } catch (err: unknown) {
    console.error(err)
    return [(err instanceof Error ? err.message : '') || '切换失败', null]
  }
}

/** 删除概览规则 */
const deleteOverviewRule = async ({ id, billId, userId }: Row) => {
  try {
    if (!(await checkBillCreator(billId, userId))) {
      return ['只有账本创建者才能管理概览规则', null]
    }
    const rule = await BillOverviewRule.findOne({ where: { id, billId } })
    if (!rule) return ['找不到该规则', null]
    await BillOverviewRuleYear.destroy({ where: { ruleId: id } })
    await BillOverviewRule.destroy({ where: { id, billId } })
    return [null, true]
  } catch (err: unknown) {
    console.error(err)
    return [(err instanceof Error ? err.message : '') || '删除概览规则失败', null]
  }
}

/** 查询数量型规则的年度配置列表 */
const getOverviewRuleYearlyList = async ({ billId, ruleId, year, userId }: Row) => {
  try {
    if (!(await checkBillMember(billId, userId))) {
      return ['无权访问该账本数据', null]
    }
    const where: WhereBag = { billId }
    if (ruleId) where.ruleId = ruleId
    if (year) where.year = Number(year)

    const list = await BillOverviewRuleYear.findAll({
      where,
      order: [['year', 'DESC']]
    })
    const billUsers = await listMembers(billId)
    const userMap = new Map<string, string>()
    billUsers.forEach((u: { id?: string; name?: string }) => {
      if (u.id) userMap.set(String(u.id), u.name || '')
    })

    const formatted = (list as Row[]).map((item) => ({
      id: item.id,
      billId: item.billId,
      ruleId: item.ruleId,
      year: item.year,
      quantity: Number(item.quantity) || 0,
      belongUserId: item.belongUserId || '',
      belongUserName: item.belongUserId ? userMap.get(String(item.belongUserId)) || '' : ''
    }))
    return [null, formatted]
  } catch (err: unknown) {
    console.error(err)
    return [(err instanceof Error ? err.message : '') || '获取年度配置失败', null]
  }
}

/** 保存/更新某一年份的规则配置 */
const saveOverviewRuleYearly = async ({ billId, ruleId, year, quantity, belongUserId, userId }: Row) => {
  try {
    if (!(await checkBillMember(billId, userId))) {
      return ['无权管理该账本数据', null]
    }
    if (!(await checkBillCreator(billId, userId))) {
      return ['只有账本创建者才能管理概览规则', null]
    }
    if (!ruleId) return ['规则ID不能为空', null]
    const yearNum = Number(year)
    if (!Number.isFinite(yearNum) || yearNum < 1970 || yearNum > 2100) {
      return ['年份不正确', null]
    }
    const qtyNum = Number(quantity)
    if (!Number.isFinite(qtyNum) || qtyNum < 0) {
      return ['数量不能为负', null]
    }

    const rule = await BillOverviewRule.findOne({ where: { id: ruleId, billId } })
    if (!rule) return ['找不到该规则', null]
    if (rule.ruleType !== RULE_TYPE_QUANTITY) {
      return ['只有数量型规则可以配置年度数据', null]
    }

    if (belongUserId) {
      const belongMember = await requireMember(belongUserId, billId)
      if (!belongMember.ok) return ['归属人不是该账本成员', null]
    }

    let record = await BillOverviewRuleYear.findOne({ where: { ruleId, year: yearNum } })
    if (record) {
      await BillOverviewRuleYear.update(
        { quantity: qtyNum, belongUserId: belongUserId || null },
        { where: { id: record.id } }
      )
      record = await BillOverviewRuleYear.findOne({ where: { id: record.id } })
    } else {
      record = await BillOverviewRuleYear.create({
        billId,
        ruleId,
        year: yearNum,
        quantity: qtyNum,
        belongUserId: belongUserId || null
      })
    }

    let belongUserName = ''
    if (record?.belongUserId) {
      const members = await listMembers(billId)
      belongUserName = members.find((u: { id?: string; name?: string }) => String(u.id) === String(record.belongUserId))?.name || ''
    }

    return [null, {
      id: record?.id,
      billId: record?.billId,
      ruleId: record?.ruleId,
      year: record?.year,
      quantity: Number(record?.quantity) || 0,
      belongUserId: record?.belongUserId || '',
      belongUserName
    }]
  } catch (err: unknown) {
    console.error(err)
    return [(err instanceof Error ? err.message : '') || '保存年度配置失败', null]
  }
}

/** 删除某年份的配置 */
const deleteOverviewRuleYearly = async ({ id, billId, userId }: Row) => {
  try {
    if (!(await checkBillMember(billId, userId))) {
      return ['无权管理该账本数据', null]
    }
    if (!(await checkBillCreator(billId, userId))) {
      return ['只有账本创建者才能管理概览规则', null]
    }
    const record = await BillOverviewRuleYear.findOne({ where: { id, billId } })
    if (!record) return ['找不到该记录', null]
    await BillOverviewRuleYear.destroy({ where: { id, billId } })
    return [null, true]
  } catch (err: unknown) {
    console.error(err)
    return [(err instanceof Error ? err.message : '') || '删除年度配置失败', null]
  }
}

export {
  createCostType,
  editCostType,
  deleteCostType,
  toggleCostTypeShow,
  createIncomeType,
  editIncomeType,
  deleteIncomeType,
  toggleIncomeTypeShow,
  createOverviewRule,
  editOverviewRule,
  toggleOverviewRule,
  deleteOverviewRule,
  getOverviewRuleYearlyList,
  saveOverviewRuleYearly,
  deleteOverviewRuleYearly
}
