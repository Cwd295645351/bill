import type { Row } from '../../types/domain'
import { Transaction, User, sequelize } from '../../database/index'
import { loadTypeLists } from '../catalog'
import { applyBudgetBatchDeltas, applyBudgetDelta } from '../budget'
import { lockBill, readBillRole, type BillRole } from '../access'
import { attachImages, markImagesUnviewableByTransaction, tryDeleteObject } from './image-service'
import { loadOrderedMembers, resolveBelongUsers } from './belong-users'
import { yearFromTimestamp } from '../../utils/dateUtil'
import { countsAsExpense, readBookDate, readPositiveMoney } from '../budget/spend'
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

/** 成员校验未通过时的提示。编号无效或账本不存在为未找到账本，未加入为不是该账本成员 */
const memberDenial = (role: BillRole) => {
  if (role.kind === 'member') return null
  if (role.kind === 'not_member') return '不是该账本成员'
  return '未找到账本'
}

type NamedType = { id?: string; name?: string }

/** 按编号读取本账本的类型。编号有值但找不到时返回错误文案 */
const requireNamedType = (list: NamedType[], id: unknown, missing: string): [string, null] | [null, NamedType] => {
  if (id == null || id === '') return [null, { id: '', name: '' }]
  const found = list.find((item) => item.id === id)
  if (!found) return [missing, null]
  return [null, found]
}

/** 单个用户本次要增减的累计支出、累计收入 */
type UserDelta = { expenses: number; incomes: number }

/** 记账行里和用户累计、预算相关的字段 */
type LedgerRow = {
  type?: unknown
  reimbursement?: unknown
  money?: unknown
  date?: unknown
  costTypeId?: unknown
  userId?: unknown
}

/** 把差额累加到对应用户。没有用户或差额为 0 时跳过 */
const rememberUser = (bag: Map<string, UserDelta>, userId: unknown, field: keyof UserDelta, delta: number) => {
  if (!userId || !delta) return
  const key = String(userId)
  const current = bag.get(key) || { expenses: 0, incomes: 0 }
  current[field] += delta
  bag.set(key, current)
}

/** 按明细方向增减用户累计，并返回预算已用差额。sign 为 1 表示记入，-1 表示冲回 */
const bookUserEffect = (users: Map<string, UserDelta>, row: LedgerRow, sign: 1 | -1) => {
  const money = Number(row.money)
  if (!Number.isFinite(money) || !money) return null as null | { year: number; costTypeId: unknown; delta: number }
  const delta = sign * money
  // 收入只进用户累计，不影响预算
  if (Number(row.type) === 2) {
    rememberUser(users, row.userId, 'incomes', delta)
    return null
  }
  // 已报销支出不计入累计，也不进入预算
  if (!countsAsExpense(row.type, row.reimbursement)) return null
  const year = yearFromTimestamp(row.date as number)
  rememberUser(users, row.userId, 'expenses', delta)
  return { year, costTypeId: row.costTypeId, delta }
}

/** 把内存里的用户累计差额写回用户表，只更新有变化的字段 */
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

/** 把多笔未报销支出聚合成年份汇总和「年份 + 分类」汇总 */
const collectBudgetDeltas = (rows: LedgerRow[], sign: 1 | -1) => {
  const yearDeltas = new Map<number, number>()
  const typeDeltas = new Map<string, number>()
  for (const row of rows) {
    const money = Number(row.money)
    if (!Number.isFinite(money) || !money) continue
    if (!countsAsExpense(row.type, row.reimbursement)) continue
    const year = yearFromTimestamp(row.date as number)
    if (!Number.isFinite(year)) continue
    const delta = sign * money
    yearDeltas.set(year, Number(((yearDeltas.get(year) || 0) + delta).toFixed(2)))
    const costTypeId = row.costTypeId == null || row.costTypeId === '' ? '' : String(row.costTypeId)
    if (!costTypeId) continue
    const key = `${year}:${costTypeId}`
    typeDeltas.set(key, Number(((typeDeltas.get(key) || 0) + delta).toFixed(2)))
  }
  return { yearDeltas, typeDeltas }
}


/**
 * 新增一笔明细。
 * 先校验金额、日期、收支类型、成员身份和归属人，再按类型写入支出或收入分类。
 * 事务内锁账本、落库、挂照片，并同步用户累计与预算已用；提交后再删被替换的对象存储文件。
 */
export const addTransaction = async (data: Row) => {
  // 金额必须为正，日期可记账，类型只接受 1 支出、2 收入
  const [moneyErr, money] = readPositiveMoney(data.money)
  if (moneyErr || money == null) return [moneyErr, null]
  const [dateErr, dateTs] = readBookDate(data.date)
  if (dateErr || dateTs == null) return [dateErr, null]
  const typeNum = Number(data.type)
  if (typeNum !== 1 && typeNum !== 2) return ['类型不正确', null]
  data.money = money
  // 操作者必须是该账本成员；账本已由身份查询确认，这里只读分类
  const role = await readBillRole(data.userId, data.billId)
  const denied = memberDenial(role)
  if (denied) return [denied, null]
  const types = await loadTypeLists(data.billId)
  const members = await loadOrderedMembers(data.billId)
  const [belongErr, belong] = resolveBelongUsers(data, data.type, members)
  if (belongErr || !belong) return [belongErr, null]
  // 支出写入分类、支付方式和报销标记；收入写入收入类型
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
      const [typeErr, costType] = requireNamedType(types.costTypes, data.costTypeId, '支出类型不存在')
      if (typeErr || !costType) return [typeErr, null]
      params.costTypeId = costType.id
      params.costTypeName = costType.name
    }
    if (data.payMethodId) {
      const [typeErr, payMethod] = requireNamedType(types.payMethods, data.payMethodId, '支付方式不存在')
      if (typeErr || !payMethod) return [typeErr, null]
      params.payMethodId = payMethod.id
      params.payMethodName = payMethod.name
    }
    params.reimbursement = data.reimbursement
  } else if (data.incomesTypeId) {
    const [typeErr, incomes] = requireNamedType(types.incomesTypes, data.incomesTypeId, '收入类型不存在')
    if (typeErr || !incomes) return [typeErr, null]
    params.incomesTypeId = incomes.id
    params.incomesTypeName = incomes.name
  }

  // 未传 imageIds 时不改照片；传了就必须是 id 数组
  const wantImages = hasImageIdsField(data)
  const imageIds = wantImages ? normalizeImageIds(data.imageIds) : null
  if (wantImages && imageIds == null) return ['照片列表无效', null]

  const tx = await sequelize.transaction()
  let pendingDeleteKeys: (string | null | undefined)[] = []
  try {
    // 锁账本后再落库，避免和预算、成员变更交错
    const locked = await lockBill(data.billId, tx)
    if (!locked) throw new Error('未找到账本')
    const res = await Transaction.create(params, { transaction: tx })
    if (!res) throw new Error('新增失败')

    // 挂上新照片，被换下的对象键先记下，提交成功后再删
    if (wantImages) {
      pendingDeleteKeys = await attachImages({
        transactionId: res.id,
        billId: data.billId,
        userId: data.userId,
        imageIds,
        sequelizeTx: tx
      })
    }

    // 记入用户累计；未报销支出同时增加预算已用
    const users = new Map<string, UserDelta>()
    const budgetDelta = bookUserEffect(users, params, 1)
    if (budgetDelta) {
      await applyBudgetDelta(data.billId, budgetDelta.year, budgetDelta.costTypeId, budgetDelta.delta, tx)
    }
    await flushUsers(users, tx)

    await tx.commit()
    // 对象存储放到提交成功后再删，回滚时照片仍可用
    for (const key of pendingDeleteKeys) {
      await tryDeleteObject(key)
    }
    return [null, true]
  } catch (e: unknown) {
    await tx.rollback()
    console.error(e)
    // 张数超限原样返回，其余统一成新增失败
    if (wantImages) return [errorText(e) === '一笔最多附 9 张照片' ? errorText(e) : '新增失败', null]
    return ['新增失败', null]
  }
}

/**
 * 同一账本批量新增明细。
 * 逐条校验金额、日期、类型、归属和分类，任一失败整批不写。
 * 事务内锁账本后一次写入，再按汇总差额更新预算和用户累计。
 */
export const batchAddTransaction = async (list: Row[]) => {
  if (!Array.isArray(list) || !list.length) return ['批量数据不能为空', null]
  // 整批以第一条的账本为准，操作者必须是成员
  const billId = list[0].billId
  const role = await readBillRole(list[0].userId, billId)
  const denied = memberDenial(role)
  if (denied) return [denied, null]
  const types = await loadTypeLists(billId)
  const members = await loadOrderedMembers(billId)

  // 逐条规范化。错误带上序号，避免整批失败时看不出是哪一条
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
        const [typeErr, costType] = requireNamedType(types.costTypes, data.costTypeId, '支出类型不存在')
        if (typeErr || !costType) return [`${prefix}${typeErr}`, null]
        params.costTypeId = costType.id
        params.costTypeName = costType.name
      }
      if (data.payMethodId) {
        const [typeErr, payMethod] = requireNamedType(types.payMethods, data.payMethodId, '支付方式不存在')
        if (typeErr || !payMethod) return [`${prefix}${typeErr}`, null]
        params.payMethodId = payMethod.id
        params.payMethodName = payMethod.name
      }
      params.reimbursement = data.reimbursement || 0
    } else if (data.incomesTypeId) {
      const [typeErr, incomes] = requireNamedType(types.incomesTypes, data.incomesTypeId, '收入类型不存在')
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
    // 用户累计逐笔记入；预算按年份和「年份 + 分类」汇总后一次更新
    const users = new Map<string, UserDelta>()
    insertList.forEach((row) => bookUserEffect(users, row, 1))
    const { yearDeltas, typeDeltas } = collectBudgetDeltas(insertList, 1)
    await applyBudgetBatchDeltas(billId, yearDeltas, typeDeltas, tx)
    await flushUsers(users, tx)
    await tx.commit()
    return [null, { total: list.length, success: res.length }]
  } catch (e: unknown) {
    await tx.rollback()
    console.error(e)
    return ['批量新增失败', null]
  }
}

/**
 * 编辑一笔未删除的明细。
 * 以库里的账本为准校验成员，请求里的账本编号必须一致，且只能改自己记的账。
 * 事务内先冲回旧金额，再按新金额记入用户累计和预算；照片在提交成功后清理对象存储。
 */
export const editTransaction = async (data: Row) => {
  const [moneyErr, money] = readPositiveMoney(data.money)
  if (moneyErr || money == null) return [moneyErr, null]
  const [dateErr, dateTs] = readBookDate(data.date)
  if (dateErr || dateTs == null) return [dateErr, null]
  const typeNum = Number(data.type)
  if (typeNum !== 1 && typeNum !== 2) return ['类型不正确', null]
  const params: Row = { id: data.id, isDel: false }
  // 以库里未删除的明细为准，不信任请求里的账本编号
  const old = await Transaction.findOne({ where: params, raw: true })
  if (!old) return ['编辑失败', null]
  const billId = String(old.billId || '')
  // 必须是该账本成员，账本编号一致，且只能改自己记的账
  const role = await readBillRole(data.userId, billId)
  const denied = memberDenial(role)
  if (denied) return [denied, null]
  if (!data.billId || String(data.billId) !== billId) return ['编辑失败', null]
  if (!data.userId || String(old.userId) !== String(data.userId)) {
    return ['只能编辑自己记的账单', null]
  }
  const types = await loadTypeLists(billId)
  // 先写入公共字段，分类按新的收支方向补齐
  const changeData: Row = {
    date: dateTs,
    remark: data.remark,
    money,
    type: typeNum,
    userId: data.userId
  }
  if (typeNum === 1) {
    if (data.costTypeId) {
      const [typeErr, costType] = requireNamedType(types.costTypes, data.costTypeId, '支出类型不存在')
      if (typeErr || !costType) return [typeErr, null]
      changeData.costTypeId = costType.id
      changeData.costTypeName = costType.name
    }
    if (data.payMethodId) {
      const [typeErr, payMethod] = requireNamedType(types.payMethods, data.payMethodId, '支付方式不存在')
      if (typeErr || !payMethod) return [typeErr, null]
      changeData.payMethodId = payMethod.id
      changeData.payMethodName = payMethod.name
    }
    // 请求没带报销标记时沿用原值，避免预算按未报销再记一笔
    changeData.reimbursement = Object.prototype.hasOwnProperty.call(data, 'reimbursement')
      ? data.reimbursement
      : old.reimbursement
  } else if (data.incomesTypeId) {
    const [typeErr, incomes] = requireNamedType(types.incomesTypes, data.incomesTypeId, '收入类型不存在')
    if (typeErr || !incomes) return [typeErr, null]
    changeData.incomesTypeId = incomes.id
    changeData.incomesTypeName = incomes.name
  }
  // 改成支出时清掉收入分类；改成收入时清掉支出分类、支付方式和报销标记
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

  // 未传 imageIds 时保留原照片
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

    // 先按旧明细冲回，再按新明细记入，差额落在同一批用户累计上
    const users = new Map<string, UserDelta>()
    const oldDelta = bookUserEffect(users, old, -1)
    if (oldDelta) {
      await applyBudgetDelta(billId, oldDelta.year, oldDelta.costTypeId, oldDelta.delta, tx)
    }
    const newDelta = bookUserEffect(users, changeData, 1)
    if (newDelta) {
      await applyBudgetDelta(billId, newDelta.year, newDelta.costTypeId, newDelta.delta, tx)
    }
    await flushUsers(users, tx)
    await tx.commit()
    // 对象存储放到提交成功后再删，回滚时照片仍可用
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

/**
 * 软删除一笔明细。
 * 操作者必须是账本成员，且只能删自己记的账。
 * 事务内标记删除、照片不可见，并冲回用户累计和预算已用；提交后再删对象存储文件。
 */
export const deleteTransaction = async (data: Row) => {
  const params: Row = { id: data.id, isDel: false }
  const old = await Transaction.findOne({ where: params, raw: true })
  if (!old) return ['该明细不存在', null]
  // 按明细真实账本校验成员，且只能删自己记的账
  const role = await readBillRole(data.operatorId, old.billId)
  const denied = memberDenial(role)
  if (denied) return [denied, null]
  if (!data.operatorId || String(old.userId) !== String(data.operatorId)) {
    return ['只能删除自己记的账单', null]
  }

  const tx = await sequelize.transaction()
  let pendingDeleteKeys: (string | null | undefined)[] = []
  try {
    const locked = await lockBill(old.billId, tx)
    if (!locked) throw new Error('未找到账本')
    // 软删除明细，并记下要清理的照片对象键
    await Transaction.update({ isDel: true }, { where: params, transaction: tx })
    pendingDeleteKeys = await markImagesUnviewableByTransaction(old.id, tx)

    // 按原明细冲回用户累计；未报销支出同时减少预算已用
    const users = new Map<string, UserDelta>()
    const budgetDelta = bookUserEffect(users, old, -1)
    if (budgetDelta) {
      await applyBudgetDelta(old.billId, budgetDelta.year, budgetDelta.costTypeId, budgetDelta.delta, tx)
    }
    await flushUsers(users, tx)
    await tx.commit()
    // 对象存储放到提交成功后再删，回滚时照片仍可用
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
