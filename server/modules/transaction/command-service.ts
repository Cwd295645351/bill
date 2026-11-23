import type { Row } from '../../types/domain'
import { Bill, Transaction, User, sequelize } from '../../database/index'
import { loadTypeLists } from '../catalog'
import { loadBudgets, saveBudget, lockBill } from '../budget'
import { requireMember } from '../access'
import { attachImages, markImagesUnviewableByTransaction, tryDeleteObject } from './image-service'
import { loadOrderedMembers, resolveBelongUsers } from './belong-users'
import { yearFromTimestamp } from '../../utils/dateUtil'
import { countsAsExpense, readBookDate, readPositiveMoney, shiftBudgetSpend, type SpendBudget } from '../budget/spend'
import type { Transaction as DbTransaction } from 'sequelize'


/** 取出异常文案。非 Error 时返回空串，调用方再决定提示。 */
const errorText = (err: unknown) => (err instanceof Error ? err.message : '')

/** 请求体是否显式携带 imageIds（不传则不动已有照片） */
const hasImageIdsField = (data: Row) => Object.prototype.hasOwnProperty.call(data || {}, 'imageIds')

/** 规范化 imageIds：必须是数组，元素为字符串 id */
const normalizeImageIds = (imageIds: unknown) => {
  if (!Array.isArray(imageIds)) return null
  return imageIds.map((id) => String(id))
}

/** 记账写入需要的类型和预算。账本不存在时返回 null */
const loadWriteBill = async (billId: string | null | undefined) => {
  const bill = await Bill.findByPk(billId)
  if (!bill) return null
  const [types, budget] = await Promise.all([loadTypeLists(billId), loadBudgets(billId)])
  return { ...types, budget }
}

type NamedType = { id?: string; name?: string }

/** 按编号读取本账本的类型。编号有值但找不到时返回错误文案 */
const requireNamedType = (list: NamedType[], id: unknown, missing: string): [string, null] | [null, NamedType] => {
  if (id == null || id === '') return [null, { id: '', name: '' }]
  const found = list.find((item) => item.id === id)
  if (!found) return [missing, null]
  return [null, found]
}

type UserDelta = { expenses: number; incomes: number }

type LedgerRow = {
  type?: unknown
  reimbursement?: unknown
  money?: unknown
  date?: unknown
  costTypeId?: unknown
  userId?: unknown
}

const rememberUser = (bag: Map<string, UserDelta>, userId: unknown, field: keyof UserDelta, delta: number) => {
  if (!userId || !delta) return
  const key = String(userId)
  const current = bag.get(key) || { expenses: 0, incomes: 0 }
  current[field] += delta
  bag.set(key, current)
}

/** 按明细方向增减预算已用和用户累计。sign 为 1 表示记入，-1 表示冲回 */
const bookEffect = (budgets: SpendBudget[], users: Map<string, UserDelta>, row: LedgerRow, sign: 1 | -1) => {
  const money = Number(row.money)
  if (!Number.isFinite(money) || !money) return
  const delta = sign * money
  if (Number(row.type) === 2) {
    rememberUser(users, row.userId, 'incomes', delta)
    return
  }
  if (!countsAsExpense(row.type, row.reimbursement)) return
  const year = yearFromTimestamp(row.date as number)
  shiftBudgetSpend(budgets, year, row.costTypeId, delta)
  rememberUser(users, row.userId, 'expenses', delta)
}

const flushUsers = async (bag: Map<string, UserDelta>, tx: DbTransaction) => {
  for (const [userId, delta] of bag) {
    const patch: { expenses?: number; incomes?: number } = {}
    if (delta.expenses) patch.expenses = delta.expenses
    if (delta.incomes) patch.incomes = delta.incomes
    if (patch.expenses || patch.incomes) {
      await User.increment(patch, { where: { id: userId }, transaction: tx })
    }
  }
}


// 新增交易信息
export const addTransaction = async (data: Row) => {
  const [moneyErr, money] = readPositiveMoney(data.money)
  if (moneyErr || money == null) return [moneyErr, null]
  const [dateErr, dateTs] = readBookDate(data.date)
  if (dateErr || dateTs == null) return [dateErr, null]
  const typeNum = Number(data.type)
  if (typeNum !== 1 && typeNum !== 2) return ['类型不正确', null]
  data.money = money
  const member = await requireMember(data.userId, data.billId)
  if (!member.ok) return ['不是该账本成员', null]
  const findBill = await loadWriteBill(data.billId)
  if (!findBill) return ['未找到账本', null]
  const members = await loadOrderedMembers(data.billId)
  const [belongErr, belong] = resolveBelongUsers(data, data.type, members)
  if (belongErr || !belong) return [belongErr, null]
  const params: Row = {
    billId: data.billId,
    userId: data.userId,
    date: dateTs,
    type: typeNum,
    remark: data.remark,
    money: data.money,
    belongUserId: belong.belongUserId,
    belongUserName: belong.belongUserName,
    isDel: false
  }
  if (params.type === 1) {
    if (data.costTypeId) {
      const [typeErr, costType] = requireNamedType(findBill.costTypes, data.costTypeId, '支出类型不存在')
      if (typeErr || !costType) return [typeErr, null]
      params.costTypeId = costType.id
      params.costTypeName = costType.name
    }
    if (data.payMethodId) {
      const [typeErr, payMethod] = requireNamedType(findBill.payMethods, data.payMethodId, '支付方式不存在')
      if (typeErr || !payMethod) return [typeErr, null]
      params.payMethodId = payMethod.id
      params.payMethodName = payMethod.name
    }
    params.reimbursement = data.reimbursement
  } else if (data.incomesTypeId) {
    const [typeErr, incomes] = requireNamedType(findBill.incomesTypes, data.incomesTypeId, '收入类型不存在')
    if (typeErr || !incomes) return [typeErr, null]
    params.incomesTypeId = incomes.id
    params.incomesTypeName = incomes.name
  }

  const wantImages = hasImageIdsField(data)
  const imageIds = wantImages ? normalizeImageIds(data.imageIds) : null
  if (wantImages && imageIds == null) return ['照片列表无效', null]

  const tx = await sequelize.transaction()
  let pendingDeleteKeys: (string | null | undefined)[] = []
  try {
    const locked = await lockBill(data.billId, tx)
    if (!locked) throw new Error('未找到账本')
    const res = await Transaction.create(params, { transaction: tx })
    if (!res) throw new Error('新增失败')

    if (wantImages) {
      pendingDeleteKeys = await attachImages({
        transactionId: res.id,
        billId: data.billId,
        userId: data.userId,
        imageIds,
        sequelizeTx: tx
      })
    }

    const budgets = await loadBudgets(data.billId, tx)
    const users = new Map<string, UserDelta>()
    bookEffect(budgets, users, params, 1)
    await saveBudget(data.billId, budgets, tx)
    await flushUsers(users, tx)

    await tx.commit()
    for (const key of pendingDeleteKeys) {
      await tryDeleteObject(key)
    }
    return [null, true]
  } catch (e: unknown) {
    await tx.rollback()
    console.error(e)
    if (wantImages) return [errorText(e) === '一笔最多附 9 张照片' ? errorText(e) : '新增失败', null]
    return ['新增失败', null]
  }
}

// 批量新增交易信息
export const batchAddTransaction = async (list: Row[]) => {
  if (!Array.isArray(list) || !list.length) return ['批量数据不能为空', null]
  const billId = list[0].billId
  const member = await requireMember(list[0].userId, billId)
  if (!member.ok) return ['不是该账本成员', null]
  const findBill = await loadWriteBill(billId)
  if (!findBill) return ['未找到账本', null]
  const members = await loadOrderedMembers(billId)

  const insertList: Row[] = []
  for (const [index, data] of list.entries()) {
    const prefix = `第 ${index + 1} 条：`
    if (String(data.billId || '') !== String(billId || '')) return [`${prefix}账本不一致`, null]
    const typeNum = Number(data.type)
    if (typeNum !== 1 && typeNum !== 2) return [`${prefix}类型不正确`, null]
    const [moneyErr, money] = readPositiveMoney(data.money)
    if (moneyErr || money == null) return [`${prefix}${moneyErr}`, null]
    const [dateErr, dateTs] = readBookDate(data.date)
    if (dateErr || dateTs == null) return [`${prefix}${dateErr}`, null]
    const [belongErr, belong] = resolveBelongUsers(data, typeNum, members)
    if (belongErr || !belong) return [`${prefix}${belongErr}`, null]
    const params: Row = {
      billId,
      userId: data.userId,
      date: dateTs,
      type: typeNum,
      remark: data.remark,
      money,
      belongUserId: belong.belongUserId,
      belongUserName: belong.belongUserName,
      isDel: false
    }
    if (typeNum === 1) {
      if (data.costTypeId) {
        const [typeErr, costType] = requireNamedType(findBill.costTypes, data.costTypeId, '支出类型不存在')
        if (typeErr || !costType) return [`${prefix}${typeErr}`, null]
        params.costTypeId = costType.id
        params.costTypeName = costType.name
      }
      if (data.payMethodId) {
        const [typeErr, payMethod] = requireNamedType(findBill.payMethods, data.payMethodId, '支付方式不存在')
        if (typeErr || !payMethod) return [`${prefix}${typeErr}`, null]
        params.payMethodId = payMethod.id
        params.payMethodName = payMethod.name
      }
      params.reimbursement = data.reimbursement || 0
    } else if (data.incomesTypeId) {
      const [typeErr, incomes] = requireNamedType(findBill.incomesTypes, data.incomesTypeId, '收入类型不存在')
      if (typeErr || !incomes) return [`${prefix}${typeErr}`, null]
      params.incomesTypeId = incomes.id
      params.incomesTypeName = incomes.name
    }
    insertList.push(params)
  }

  const tx = await sequelize.transaction()
  try {
    const locked = await lockBill(billId, tx)
    if (!locked) throw new Error('未找到账本')
    const res = await Transaction.bulkCreate(insertList, { transaction: tx })
    if (!res) throw new Error('批量新增失败')
    const budgets = await loadBudgets(billId, tx)
    const users = new Map<string, UserDelta>()
    insertList.forEach((row) => bookEffect(budgets, users, row, 1))
    await saveBudget(billId, budgets, tx)
    await flushUsers(users, tx)
    await tx.commit()
    return [null, { total: list.length, success: res.length }]
  } catch (e: unknown) {
    await tx.rollback()
    console.error(e)
    return ['批量新增失败', null]
  }
}

// 编辑交易信息。先按明细真实账本确认成员，账本编号必须一致，再判断记账人
export const editTransaction = async (data: Row) => {
  const [moneyErr, money] = readPositiveMoney(data.money)
  if (moneyErr || money == null) return [moneyErr, null]
  const [dateErr, dateTs] = readBookDate(data.date)
  if (dateErr || dateTs == null) return [dateErr, null]
  const typeNum = Number(data.type)
  if (typeNum !== 1 && typeNum !== 2) return ['类型不正确', null]
  const params: Row = { id: data.id, isDel: false }
  const old = await Transaction.findOne({ where: params, raw: true })
  if (!old) return ['编辑失败', null]
  const billId = String(old.billId || '')
  const member = await requireMember(data.userId, billId)
  if (!member.ok) return ['不是该账本成员', null]
  if (!data.billId || String(data.billId) !== billId) return ['编辑失败', null]
  if (!data.userId || String(old.userId) !== String(data.userId)) {
    return ['只能编辑自己记的账单', null]
  }
  const findBill = await loadWriteBill(billId)
  if (!findBill) return ['未找到账本', null]
  const changeData: Row = {
    date: dateTs,
    remark: data.remark,
    money,
    type: typeNum,
    userId: data.userId
  }
  if (typeNum === 1) {
    if (data.costTypeId) {
      const [typeErr, costType] = requireNamedType(findBill.costTypes, data.costTypeId, '支出类型不存在')
      if (typeErr || !costType) return [typeErr, null]
      changeData.costTypeId = costType.id
      changeData.costTypeName = costType.name
    }
    if (data.payMethodId) {
      const [typeErr, payMethod] = requireNamedType(findBill.payMethods, data.payMethodId, '支付方式不存在')
      if (typeErr || !payMethod) return [typeErr, null]
      changeData.payMethodId = payMethod.id
      changeData.payMethodName = payMethod.name
    }
    // 请求没带报销标记时沿用原值，避免预算按未报销再记一笔
    changeData.reimbursement = Object.prototype.hasOwnProperty.call(data, 'reimbursement')
      ? data.reimbursement
      : old.reimbursement
  } else if (data.incomesTypeId) {
    const [typeErr, incomes] = requireNamedType(findBill.incomesTypes, data.incomesTypeId, '收入类型不存在')
    if (typeErr || !incomes) return [typeErr, null]
    changeData.incomesTypeId = incomes.id
    changeData.incomesTypeName = incomes.name
  }
  if (typeNum === 1) {
    if (!changeData.costTypeId) {
      changeData.costTypeId = old.costTypeId
      changeData.costTypeName = old.costTypeName
    }
    changeData.incomesTypeId = ''
    changeData.incomesTypeName = ''
  } else {
    changeData.costTypeId = ''
    changeData.costTypeName = ''
    changeData.payMethodId = ''
    changeData.payMethodName = ''
    changeData.reimbursement = 0
  }
  const members = await loadOrderedMembers(billId)
  const [belongErr, belong] = resolveBelongUsers(data, typeNum, members)
  if (belongErr || !belong) return [belongErr, null]
  changeData.belongUserId = belong.belongUserId
  changeData.belongUserName = belong.belongUserName

  const wantImages = hasImageIdsField(data)
  const imageIds = wantImages ? normalizeImageIds(data.imageIds) : null
  if (wantImages && imageIds == null) return ['照片列表无效', null]

  const tx = await sequelize.transaction()
  let pendingDeleteKeys: (string | null | undefined)[] = []
  try {
    const locked = await lockBill(billId, tx)
    if (!locked) throw new Error('未找到账本')
    await Transaction.update(changeData, { where: params, transaction: tx })

    if (wantImages) {
      pendingDeleteKeys = await attachImages({
        transactionId: old.id,
        billId,
        userId: data.userId,
        imageIds,
        sequelizeTx: tx
      })
    }

    const budgets = await loadBudgets(billId, tx)
    const users = new Map<string, UserDelta>()
    bookEffect(budgets, users, old, -1)
    bookEffect(budgets, users, changeData, 1)
    await saveBudget(billId, budgets, tx)
    await flushUsers(users, tx)
    await tx.commit()
    for (const key of pendingDeleteKeys) {
      await tryDeleteObject(key)
    }
    return [null, true]
  } catch (e: unknown) {
    await tx.rollback()
    console.error(e)
    if (wantImages) return [errorText(e) === '一笔最多附 9 张照片' ? errorText(e) : '编辑失败', null]
    return ['编辑失败', null]
  }
}

// 删除交易信息
export const deleteTransaction = async (data: Row) => {
  const params: Row = { id: data.id, isDel: false }
  const old = await Transaction.findOne({ where: params, raw: true })
  if (!old) return ['该明细不存在', null]
  const member = await requireMember(data.operatorId, old.billId)
  if (!member.ok) return ['不是该账本成员', null]
  if (!data.operatorId || String(old.userId) !== String(data.operatorId)) {
    return ['只能删除自己记的账单', null]
  }

  const tx = await sequelize.transaction()
  let pendingDeleteKeys: (string | null | undefined)[] = []
  try {
    const locked = await lockBill(old.billId, tx)
    if (!locked) throw new Error('未找到账本')
    await Transaction.update({ isDel: true }, { where: params, transaction: tx })
    pendingDeleteKeys = await markImagesUnviewableByTransaction(old.id, tx)

    const budgets = await loadBudgets(old.billId, tx)
    const users = new Map<string, UserDelta>()
    bookEffect(budgets, users, old, -1)
    await saveBudget(old.billId, budgets, tx)
    await flushUsers(users, tx)
    await tx.commit()
    for (const key of pendingDeleteKeys) {
      await tryDeleteObject(key)
    }
    return [null, true]
  } catch (e: unknown) {
    await tx.rollback()
    console.error(e)
    return ['删除失败', null]
  }
}
