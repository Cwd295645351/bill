import type { HttpContext, Row, WhereBag } from '../../types/domain'
import { Transaction, User } from '../../database/index'
import { findBillById, saveBudget, sequelize } from '../../database/services/billService'
import { uploadImage, attachImages, markImagesUnviewableByTransaction, attachImagesToList, getImageFile, tryDeleteObject, assertBillMember } from '../../database/services/transactionImageService'
import { loadOrderedMembers, resolveBelongUsers, buildBelongWhere, toBelongResponse } from '../../database/services/belongUsers'
import { Op } from 'sequelize'
import dayjs from 'dayjs'
import { toTimestamp, yearFromTimestamp, formatDate } from '../../utils/dateUtil'
import { createXlsx } from '../../utils/xlsx'
import xlsx from 'node-xlsx'
import fs from 'fs'

/** 取出异常文案。非 Error 时返回空串，调用方再决定提示。 */
const errorText = (err: unknown) => (err instanceof Error ? err.message : '')

/** 请求体是否显式携带 imageIds（不传则不动已有照片） */
const hasImageIdsField = (data: Row) => Object.prototype.hasOwnProperty.call(data || {}, 'imageIds')

/** 规范化 imageIds：必须是数组，元素为字符串 id */
const normalizeImageIds = (imageIds: unknown) => {
  if (!Array.isArray(imageIds)) return null
  return imageIds.map((id) => String(id))
}

/** 金额保留两位小数（返回 number） */
const fixMoney = (n: number | string | null | undefined) => Number(Number(n).toFixed(2))

/** 将单个 id 或 id 数组统一为数组，避免 Op.in 收到字符串时按字符拆分 */
const toIdList = (value: unknown) => {
  if (value == null || value === '') return null
  return Array.isArray(value) ? value : [value]
}

const ORDER_DESC: [string, string][] = [
  ['date', 'DESC'],
  ['id', 'DESC']
]
const ORDER_ASC: [string, string][] = [
  ['date', 'ASC'],
  ['id', 'ASC']
]

/** 组装明细筛选条件。日期范围单独放入 andList，便于再叠加游标条件 */
const buildFilter = (data: Row) => {
  const where: WhereBag = {
    billId: data.billId,
    type: data.type,
    isDel: false,
    money: {}
  }
  const moneyOpMap: Record<string, symbol> = { gt: Op.gt, gte: Op.gte, lt: Op.lt, lte: Op.lte, eq: Op.eq }
  const condition = typeof data.condition === 'string' ? data.condition : ''
  const moneyOp = moneyOpMap[condition] || Op.gte
  where.money = { [moneyOp]: data.rangeMoney }

  const andList: WhereBag[] = []
  const beginTs = toTimestamp(data.beginDate)
  const endTs = toTimestamp(data.endDate)
  if (beginTs != null && endTs != null) {
    andList.push({ date: { [Op.between]: [beginTs, endTs] } })
  } else if (beginTs != null) {
    andList.push({ date: { [Op.gte]: beginTs } })
  } else if (endTs != null) {
    andList.push({ date: { [Op.lte]: endTs } })
  }

  if (data.remark) where.remark = { [Op.like]: `%${data.remark}%` }
  if (data.costTypeId) where.costTypeId = data.costTypeId
  if (data.payMethodId) where.payMethodId = data.payMethodId
  if (data.incomesTypeId) where.incomesTypeId = data.incomesTypeId
  const userIds = toIdList(data.userId)
  if (userIds) where.userId = { [Op.in]: userIds }
  const belongWhere = buildBelongWhere(data.belongUserIds)
  if (belongWhere) andList.push(belongWhere)

  return { where, andList }
}

/** 把日期范围与游标条件一并并入 where */
const withAnd = (where: WhereBag, andList: WhereBag[], extra?: WhereBag) => {
  const list = extra ? [...andList, extra] : [...andList]
  if (!list.length) return where
  return { ...where, [Op.and]: list }
}

/** 比游标更早：日期更小，或同一天且 id 更小（与 date DESC, id DESC 一致） */
const olderThanCursor = (cursorDate: number | string | null | undefined, cursorId: string | null | undefined) => {
  if (!cursorId) return { date: { [Op.lt]: cursorDate } }
  return {
    [Op.or]: [
      { date: { [Op.lt]: cursorDate } },
      { [Op.and]: [{ date: cursorDate }, { id: { [Op.lt]: cursorId } }] }
    ]
  }
}

/** 比游标更新：日期更大，或同一天且 id 更大 */
const newerThanCursor = (cursorDate: number | string | null | undefined, cursorId: string | null | undefined) => {
  if (!cursorId) return { date: { [Op.gt]: cursorDate } }
  return {
    [Op.or]: [
      { date: { [Op.gt]: cursorDate } },
      { [Op.and]: [{ date: cursorDate }, { id: { [Op.gt]: cursorId } }] }
    ]
  }
}

/** 多取 1 条判断是否还有下一页，返回给前端的数据不含这 1 条 */
const queryPage = async (where: WhereBag, order: [string, string][], pageSize: number | string | undefined) => {
  const size = Number(pageSize)
  const rows = await Transaction.findAll({
    where,
    order,
    limit: Number.isFinite(size) ? size + 1 : undefined
  })
  const hasMore = Number.isFinite(size) && rows.length > size
  return { rows: hasMore ? rows.slice(0, size) : rows, hasMore }
}

/** 按筛选条件聚合各月笔数与金额，归月使用 dayjs，避免数据库时区与前端不一致 */
const loadMonthSummaries = async (where: WhereBag) => {
  const rows = await Transaction.findAll({
    where,
    attributes: ['date', 'money'],
    raw: true
  })
  const map = new Map<string, { month: string; count: number; money: number }>()
  rows.forEach((row: Row) => {
    const month = dayjs(Number(row.date)).format('YYYY-MM')
    let item = map.get(month)
    if (!item) {
      item = { month, count: 0, money: 0 }
      map.set(month, item)
    }
    item.count += 1
    item.money += Number(row.money) || 0
  })
  return [...map.values()]
    .map((item) => ({ ...item, money: fixMoney(item.money) }))
    .sort((a, b) => (a.month < b.month ? 1 : -1))
}

// 查询列表
export const getList = async (data: Row, ctx: HttpContext) => {
  const pageIndex = data.pageIndex
  const pageSize = data.pageSize
  const { where, andList } = buildFilter(data)
  const filterWhere = withAnd(where, andList)
  const direction = data.direction
  const anchorTs = toTimestamp(data.anchorDate)
  const useCursor = direction === 'latest' || direction === 'older' || direction === 'newer' || anchorTs != null
  const listOpts = { billId: data.billId, userId: data.viewerUserId, ctx }

  // 未传游标参数时保持原来的页码分页，供总览、移动端继续使用
  if (!useCursor) {
    const res = await Transaction.findAll({
      where: filterWhere,
      order: [['date', 'DESC']],
      offset: Number(pageIndex) * Number(pageSize),
      limit: Number.isFinite(Number(pageSize)) ? Number(pageSize) : undefined
    })
    const length = await Transaction.count({ where: filterWhere })
    if (res) {
      const datas = (await attachImagesToList(res, listOpts)).map(toBelongResponse)
      return [null, { total: length, datas }]
    }
    return ['查询失败', res]
  }

  let datas: Row[] = []
  let hasOlder = false
  let hasNewer = false

  if (anchorTs != null && direction !== 'older' && direction !== 'newer') {
    // 定位：该日及更早一页 + 该日之后一页
    const anchorEnd = dayjs(anchorTs).endOf('day').valueOf()
    const olderWhere = withAnd(where, andList, { date: { [Op.lte]: anchorEnd } })
    const newerWhere = withAnd(where, andList, { date: { [Op.gt]: anchorEnd } })
    const older = await queryPage(olderWhere, ORDER_DESC, pageSize)
    const newer = await queryPage(newerWhere, ORDER_ASC, pageSize)
    datas = [...newer.rows].reverse().concat(older.rows)
    hasOlder = older.hasMore
    hasNewer = newer.hasMore
  } else if (direction === 'older' || direction === 'newer') {
    const cursorDate = toTimestamp(data.cursorDate)
    if (cursorDate == null) return ['游标日期不能为空', null]
    const page = await queryPage(
      withAnd(where, andList, direction === 'older' ? olderThanCursor(cursorDate, data.cursorId) : newerThanCursor(cursorDate, data.cursorId)),
      direction === 'older' ? ORDER_DESC : ORDER_ASC,
      pageSize
    )
    datas = direction === 'older' ? page.rows : [...page.rows].reverse()
    hasOlder = direction === 'older' ? page.hasMore : true
    hasNewer = direction === 'newer' ? page.hasMore : true
  } else {
    const page = await queryPage(filterWhere, ORDER_DESC, pageSize)
    datas = page.rows
    hasOlder = page.hasMore
    hasNewer = false
  }

  const total = await Transaction.count({ where: filterWhere })
  datas = (await attachImagesToList(datas, listOpts)).map(toBelongResponse)
  const retData: {
    total: number
    datas: Row[]
    hasOlder: boolean
    hasNewer: boolean
    monthSummaries?: { month: string; count: number; money: number }[]
  } = { total, datas, hasOlder, hasNewer }
  if (data.withMonthSummary) {
    retData.monthSummaries = await loadMonthSummaries(filterWhere)
  }
  return [null, retData]
}

// 上传一张照片（未挂接）
export const uploadTransactionImage = async ({
  file,
  billId,
  userId
}: {
  file?: { filepath?: string; size?: number } | null
  billId?: string | null
  userId?: string | null
}) => {
  const isMember = await assertBillMember(billId, userId)
  if (!isMember) return ['未找到账本', null]
  return uploadImage({ file, billId, userId })
}

// 按签名打开照片
export const openTransactionImage = async (query: {
  id?: string | string[]
  exp?: string | string[]
  sig?: string | string[]
}) => getImageFile(query)

// 新增交易信息
export const addTransaction = async (data: Row) => {
  data.money = Number(data.money)
  const findBill = await findBillById(data.billId)
  if (!findBill) return ['未找到账本', null]
  const members = await loadOrderedMembers(data.billId)
  const [belongErr, belong] = resolveBelongUsers(data, data.type, members)
  if (belongErr || !belong) return [belongErr, null]
  const params: Row = {
    billId: data.billId,
    userId: data.userId,
    date: toTimestamp(data.date),
    type: data.type,
    remark: data.remark,
    money: data.money,
    belongUserId: belong.belongUserId,
    belongUserName: belong.belongUserName,
    isDel: false
  }
  if (params.type === 1) {
    if (data.costTypeId) {
      const costType = findBill.costTypes.find((item) => item.id === data.costTypeId)!
      params.costTypeId = costType.id
      params.costTypeName = costType.name
    }
    if (data.payMethodId) {
      const payMethod = findBill.payMethods.find((item) => item.id === data.payMethodId)!
      params.payMethodId = payMethod.id
      params.payMethodName = payMethod.name
    }
    params.reimbursement = data.reimbursement
  } else {
    if (data.incomesTypeId) {
      const incomes = findBill.incomesTypes.find((item) => item.id === data.incomesTypeId)!
      params.incomesTypeId = incomes.id
      params.incomesTypeName = incomes.name
    }
  }

  const wantImages = hasImageIdsField(data)
  const imageIds = wantImages ? normalizeImageIds(data.imageIds) : null
  if (wantImages && imageIds == null) return ['照片列表无效', null]

  const tx = await sequelize.transaction()
  let pendingDeleteKeys: (string | null | undefined)[] = []
  try {
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

    // 需要增加用户表的总支出或总收入 + 更新账本预算
    if (params.type === 1) {
      const budget = findBill.budget || []
      const year = yearFromTimestamp(params.date)
      const budgetItem = budget.find((item) => item.date === year)
      if (budgetItem) {
        budgetItem.currCost = Number(budgetItem.currCost || 0) + data.money
        const budgetDetail = budgetItem.details!.find((item) => item.costTypeId === data.costTypeId)
        if (budgetDetail) budgetDetail.cost = Number(budgetDetail.cost || 0) + data.money
      } else {
        budget.push({ date: year, totalBudget: 0, currCost: data.money, details: [] })
      }
      await saveBudget(data.billId, budget, tx)
      await User.increment({ expenses: data.money }, { where: { id: data.userId }, transaction: tx })
    } else {
      await User.increment({ incomes: data.money }, { where: { id: data.userId }, transaction: tx })
    }

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
  const billId = list[0].billId
  const findBill = await findBillById(billId)
  if (!findBill) return ['未找到账本', null]
  const members = await loadOrderedMembers(billId)

  const insertList: Row[] = []
  let totalMoney = 0
  const budgetMap: Record<string, { total: number; costTypes: Record<string, number> }> = {}

  for (const [index, data] of list.entries()) {
    const [belongErr, belong] = resolveBelongUsers(data, data.type, members)
    if (belongErr || !belong) return [`第 ${index + 1} 条：${belongErr}`, null]
    data.money = Number(data.money)
    totalMoney += data.money
    const params: Row = {
      billId: data.billId,
      userId: data.userId,
      date: toTimestamp(data.date),
      type: data.type,
      remark: data.remark,
      money: data.money,
      belongUserId: belong.belongUserId,
      belongUserName: belong.belongUserName,
      isDel: false
    }
    if (params.type === 1) {
      if (data.costTypeId) {
        const costType = findBill.costTypes.find((item) => item.id === data.costTypeId)
        if (costType) {
          params.costTypeId = costType.id
          params.costTypeName = costType.name
        }
      }
      if (data.payMethodId) {
        const payMethod = findBill.payMethods.find((item) => item.id === data.payMethodId)
        if (payMethod) {
          params.payMethodId = payMethod.id
          params.payMethodName = payMethod.name
        }
      }
      params.reimbursement = data.reimbursement || 0
    }
    insertList.push(params)

    const year = String(yearFromTimestamp(params.date))
    if (!budgetMap[year]) budgetMap[year] = { total: 0, costTypes: {} }
    budgetMap[year].total += Number(data.money)
    if (data.costTypeId) {
      if (!budgetMap[year].costTypes[data.costTypeId]) budgetMap[year].costTypes[data.costTypeId] = 0
      budgetMap[year].costTypes[data.costTypeId] += Number(data.money)
    }
  }

  const tx = await sequelize.transaction()
  try {
    const res = await Transaction.bulkCreate(insertList, { transaction: tx })
    if (!res) throw new Error('批量新增失败')

  const budget = findBill.budget || []
  for (const [yearStr, yearData] of Object.entries(budgetMap)) {
    const year = Number(yearStr)
    const budgetItem = budget.find((item) => item.date === year)
    if (budgetItem) {
      budgetItem.currCost = Number(budgetItem.currCost || 0) + yearData.total
      for (const [costTypeId, money] of Object.entries(yearData.costTypes)) {
        const budgetDetail = budgetItem.details!.find((item) => item.costTypeId === costTypeId)
        if (budgetDetail) budgetDetail.cost = Number(budgetDetail.cost || 0) + Number(money)
      }
    } else {
      budget.push({ date: year, totalBudget: 0, currCost: yearData.total, details: [] })
    }
  }

    const userId = list[0].userId
    await saveBudget(billId, budget, tx)
    await User.increment({ expenses: totalMoney }, { where: { id: userId }, transaction: tx })
    await tx.commit()
    return [null, { total: list.length, success: res.length }]
  } catch (e: unknown) {
    await tx.rollback()
    console.error(e)
    return ['批量新增失败', null]
  }
}

// 编辑交易信息
export const editTransaction = async (data: Row) => {
  data.money = Number(data.money)
  const findBill = await findBillById(data.billId)
  if (!findBill) return ['未找到账本', null]
  const params: Row = { id: data.id, isDel: false }
  const changeData: Row = {
    date: toTimestamp(data.date),
    remark: data.remark,
    money: data.money,
    type: data.type
  }
  if (data.type === 1) {
    if (data.costTypeId) {
      const costType = findBill.costTypes.find((item) => item.id === data.costTypeId)!
      changeData.costTypeId = costType.id
      changeData.costTypeName = costType.name
    }
    if (data.payMethodId) {
      const payMethod = findBill.payMethods.find((item) => item.id === data.payMethodId)!
      changeData.payMethodId = payMethod.id
      changeData.payMethodName = payMethod.name
    }
    changeData.reimbursement = data.reimbursement
  } else {
    if (data.incomesTypeId) {
      const incomes = findBill.incomesTypes.find((item) => item.id === data.incomesTypeId)!
      changeData.incomesTypeId = incomes.id
      changeData.incomesTypeName = incomes.name
    }
  }
  const old = await Transaction.findOne({ where: params, raw: true })
  if (!old) return ['编辑失败', null]
  if (!data.userId || String(old.userId) !== String(data.userId)) {
    return ['只能编辑自己记的账单', null]
  }
  const members = await loadOrderedMembers(data.billId)
  const [belongErr, belong] = resolveBelongUsers(data, data.type, members)
  if (belongErr || !belong) return [belongErr, null]
  changeData.belongUserId = belong.belongUserId
  changeData.belongUserName = belong.belongUserName

  const wantImages = hasImageIdsField(data)
  const imageIds = wantImages ? normalizeImageIds(data.imageIds) : null
  if (wantImages && imageIds == null) return ['照片列表无效', null]

  const tx = await sequelize.transaction()
  let pendingDeleteKeys: (string | null | undefined)[] = []
  try {
    await Transaction.update(changeData, { where: params, transaction: tx })

    if (wantImages) {
      pendingDeleteKeys = await attachImages({
        transactionId: old.id,
        billId: data.billId,
        userId: data.userId,
        imageIds,
        sequelizeTx: tx
      })
    }

    const differenceMoney = data.money - Number(old.money) // 编辑后的金额差

    if (data.type === 1) {
      const budget = findBill.budget || []
      const year = yearFromTimestamp(changeData.date)
      const budgetItem = budget.find((item) => item.date === year)
      if (budgetItem) {
        budgetItem.currCost = Number(budgetItem.currCost || 0) + differenceMoney
        const budgetDetail = budgetItem.details!.find((item) => item.costTypeId === data.costTypeId)
        if (budgetDetail) budgetDetail.cost = Number(budgetDetail.cost || 0) + differenceMoney
      }
      await saveBudget(data.billId, budget, tx)
      await User.increment({ expenses: differenceMoney }, { where: { id: data.userId }, transaction: tx })
    } else {
      await User.increment({ incomes: differenceMoney }, { where: { id: data.userId }, transaction: tx })
    }
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
  if (!data.operatorId || String(old.userId) !== String(data.operatorId)) {
    return ['只能删除自己记的账单', null]
  }

  const findBill = await findBillById(old.billId)
  if (!findBill) return ['未找到账本', null]

  const tx = await sequelize.transaction()
  let pendingDeleteKeys: (string | null | undefined)[] = []
  try {
    await Transaction.update({ isDel: true }, { where: params, transaction: tx })
    pendingDeleteKeys = await markImagesUnviewableByTransaction(old.id, tx)

  // 支出交易明细创删除成功后，需向账本表的预算删除数据，并需要减少用户表的总支出或总收入
    if (old.type === 1) {
    // 支出交易明细删除成功后，需向账本表的预算更改数据
      const budget = findBill.budget || []
    // 若有对应预算，对增加对应预算分项的支出金额
      const year = yearFromTimestamp(old.date)
    const budgetItem = budget.find((item) => item.date === year)
    if (budgetItem) {
        budgetItem.currCost = Number(budgetItem.currCost || 0) - Number(old.money)
        const budgetDetail = budgetItem.details!.find((item) => item.costTypeId === data.costTypeId)
      if (budgetDetail) {
          budgetDetail.cost = Number(budgetDetail.cost || 0) - Number(old.money)
      }
    }
      await saveBudget(old.billId, budget, tx)
      await User.increment({ expenses: 0 - Number(old.money) }, { where: { id: old.userId }, transaction: tx })
    } else {
      await User.increment({ incomes: 0 - Number(old.money) }, { where: { id: old.userId }, transaction: tx })
    }
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

// 查询当月收支和各归属人概况
export const getCurrentMonthCost = async (data: Row, userId: string | null | undefined) => {
  const beginTs = toTimestamp(data.beginDate)
  const endTs = toTimestamp(data.endDate)
  const params: WhereBag = {
    billId: data.billId,
    reimbursement: 0,
    type: 1,
    isDel: false
  }
  if (beginTs != null && endTs != null) {
    params.date = { [Op.between]: [beginTs, endTs] }
  }
  const res = await Transaction.findAll({
    where: params,
    attributes: ['type', 'money', 'belongUserId', 'costTypeId', 'costTypeName', 'belongUserName', 'userId']
  })
  let totalCost = 0,
    belongUserCosts: { belongUserId?: string | null; belongUserName?: string | null; userId?: string | null; money: number }[] = [],
    costTypeCost: { type?: string | number | null; name?: string | null; money: number }[] = []
  res.forEach((item: Row) => {
    const money = Number(item.money) || 0
    totalCost += money
    // 统计各个归属人支出的金额
    const user = belongUserCosts.find((ite) => ite.belongUserId === item.belongUserId && ite.userId === item.userId)
    if (user) {
      user.money += money
    } else {
      belongUserCosts.push({
        belongUserId: item.belongUserId,
        belongUserName: item.belongUserName,
        userId: item.userId,
        money
      })
    }
    // 统计当月各个支出类型的金额
    const costType = costTypeCost.find((ite) => ite.type === item.costTypeId)
    if (costType) {
      costType.money += money
    } else {
      costTypeCost.push({ type: item.costTypeId, name: item.costTypeName, money })
    }
  })

  const belongCosts = belongUserCosts.map((item) => toBelongResponse({ ...item, money: fixMoney(item.money) } as Row))
  // 按照从大到小排序
  costTypeCost = costTypeCost
    .sort((a, b) => (b.money || 0) - (a.money || 0))
    .map((item) => ({ ...item, money: fixMoney(item.money) }))

  if (res) return [null, { totalCost: fixMoney(totalCost), belongUserCosts: belongCosts, costTypeCost }]
  else return ['查询失败', null]
}

// 导出交易明细
export const exportData = async (data: Row) => {
  const params: Row = {
    billId: data.billId,
    type: data.type,
    isDel: false
  }
  const findBill = await findBillById(data.billId)
  if (!findBill) return ['未找到账本', null]
  const users: Record<string, string | undefined> = {}
  findBill.users.forEach((item) => {
    if (item.id) users[item.id] = item.name
  })

  const exportParams: WhereBag = {
    billId: data.billId,
    type: data.type,
    isDel: false,
    money: {}
  }
  const moneyOpMap: Record<string, symbol> = { gt: Op.gt, gte: Op.gte, lt: Op.lt, lte: Op.lte, eq: Op.eq }
  const moneyOp = moneyOpMap[data.condition || ''] || Op.gte
  exportParams.money = { [moneyOp]: data.rangeMoney }
  const beginTs = toTimestamp(data.beginDate)
  const endTs = toTimestamp(data.endDate)
  if (beginTs != null && endTs != null) {
    exportParams.date = { [Op.between]: [beginTs, endTs] }
  } else if (beginTs != null) {
    exportParams.date = { [Op.gte]: beginTs }
  } else if (endTs != null) {
    exportParams.date = { [Op.lte]: endTs }
  }
  if (data.remark) exportParams.remark = { [Op.like]: `%${data.remark}%` }
  if (data.costTypeId) exportParams.costTypeId = data.costTypeId
  if (data.payMethodId) exportParams.payMethodId = data.payMethodId
  if (data.incomesTypeId) exportParams.incomesTypeId = data.incomesTypeId
  const exportUserIds = toIdList(data.userId)
  if (exportUserIds) exportParams.userId = { [Op.in]: exportUserIds }
  const exportBelongWhere = buildBelongWhere(data.belongUserIds)
  if (exportBelongWhere) exportParams[Op.and] = [exportBelongWhere]

  const res = await Transaction.findAll({
    where: exportParams,
    attributes: ['date', 'costTypeName', 'userId', 'belongUserName', 'money', 'remark'],
    order: [['date', 'DESC']]
  })
  const excelSrcData = res.map((item: Row) => ({
    date: formatDate(item.getDataValue ? item.getDataValue('date') : item.date),
    costTypeName: item.costTypeName,
    belongUserName: item.belongUserName,
    money: item.money,
    remark: item.remark,
    userName: users[item.userId || '']
  }))
  const headerMaps: Row[] = [
    { key: 'date', name: '日期' },
    { key: 'costTypeName', name: '类型' },
    { key: 'belongUserName', name: '归属人' },
    { key: 'money', name: '金额' },
    { key: 'remark', name: '备注' },
    { key: 'userName', name: '记账人' }
  ]
  const buffer = createXlsx(excelSrcData, headerMaps)
  return buffer
}

// 解析 excel 文件
export const getExcelObjs = async (filePath: string, billId: string, userId: string) => {
  const findBill = await findBillById(billId)
  if (!findBill) return ['未找到账本', null]
  const workbook = xlsx.parse(filePath)
  const xlsxData = workbook[0].data
  xlsxData.shift()

  const insertData = xlsxData.map((item) => {
    const cells = item as (string | number | null | undefined)[]
    const obj: Row = {
      billId: billId,
      userId: userId,
      date: toTimestamp(cells[0] ?? null),
      type: 1,
      costTypeId: '',
      costTypeName: cells[1] == null ? '' : String(cells[1]),
      reimbursement: 0,
      belongUserId: '',
      belongUserName: cells[2] == null ? '' : String(cells[2]),
      money: typeof cells[3] === 'number' || typeof cells[3] === 'string' ? cells[3] : '',
      remark: cells[4] == null ? '' : String(cells[4]),
      isDel: false
    }
    const costType = findBill.costTypes.find((ite) => ite.name === obj.costTypeName)!
    obj.costTypeId = costType.id
    const belongUser = findBill.users.find((ite) => ite.name === obj.belongUserName)
    if (belongUser) obj.belongUserId = belongUser.id
    const user = findBill.users.find((ite) => ite.name === (cells[5] == null ? '' : String(cells[5])))
    if (user) obj.userId = user.id
    return obj
  })
  const res = await Transaction.bulkCreate(insertData)
  fs.unlinkSync(filePath) // 删除文件
  if (res) return [null, '导入成功']
  return ['导出失败', null]
}
