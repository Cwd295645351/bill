import type { Row, WhereBag } from '../../types/domain'
import { Bill, Transaction, User, sequelize } from '../../database/index'
import { loadTypeLists } from '../catalog'
import { loadBudgets, saveBudget } from '../budget'
import { requireMember } from '../access'
import { uploadImage, attachImages, markImagesUnviewableByTransaction, attachImagesToList, getImageFile, tryDeleteObject, assertBillMember } from './image-service'
import { loadOrderedMembers, resolveBelongUsers, buildBelongWhere, toBelongResponse } from './belong-users'
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

/** 记账写入需要的类型和预算。账本不存在时返回 null */
const loadWriteBill = async (billId: string | null | undefined) => {
  const bill = await Bill.findByPk(billId)
  if (!bill) return null
  const [types, budget] = await Promise.all([loadTypeLists(billId), loadBudgets(billId)])
  return { ...types, budget }
}


// 新增交易信息
export const addTransaction = async (data: Row) => {
  data.money = Number(data.money)
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
      const costType = findBill.costTypes.find((item: { id?: string; name?: string }) => item.id === data.costTypeId)!
      params.costTypeId = costType.id
      params.costTypeName = costType.name
    }
    if (data.payMethodId) {
      const payMethod = findBill.payMethods.find((item: { id?: string; name?: string }) => item.id === data.payMethodId)!
      params.payMethodId = payMethod.id
      params.payMethodName = payMethod.name
    }
    params.reimbursement = data.reimbursement
  } else {
    if (data.incomesTypeId) {
      const incomes = findBill.incomesTypes.find((item: { id?: string; name?: string }) => item.id === data.incomesTypeId)!
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
  const member = await requireMember(list[0].userId, billId)
  if (!member.ok) return ['不是该账本成员', null]
  const findBill = await loadWriteBill(billId)
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
        const costType = findBill.costTypes.find((item: { id?: string; name?: string }) => item.id === data.costTypeId)
        if (costType) {
          params.costTypeId = costType.id
          params.costTypeName = costType.name
        }
      }
      if (data.payMethodId) {
        const payMethod = findBill.payMethods.find((item: { id?: string; name?: string }) => item.id === data.payMethodId)
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

// 编辑交易信息。先按明细真实账本确认成员，账本编号必须一致，再判断记账人
export const editTransaction = async (data: Row) => {
  data.money = Number(data.money)
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
    date: toTimestamp(data.date),
    remark: data.remark,
    money: data.money,
    type: data.type
  }
  if (data.type === 1) {
    if (data.costTypeId) {
      const costType = findBill.costTypes.find((item: { id?: string; name?: string }) => item.id === data.costTypeId)!
      changeData.costTypeId = costType.id
      changeData.costTypeName = costType.name
    }
    if (data.payMethodId) {
      const payMethod = findBill.payMethods.find((item: { id?: string; name?: string }) => item.id === data.payMethodId)!
      changeData.payMethodId = payMethod.id
      changeData.payMethodName = payMethod.name
    }
    changeData.reimbursement = data.reimbursement
  } else {
    if (data.incomesTypeId) {
      const incomes = findBill.incomesTypes.find((item: { id?: string; name?: string }) => item.id === data.incomesTypeId)!
      changeData.incomesTypeId = incomes.id
      changeData.incomesTypeName = incomes.name
    }
  }
  const members = await loadOrderedMembers(billId)
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
        billId,
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
      await saveBudget(billId, budget, tx)
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
  const member = await requireMember(data.operatorId, old.billId)
  if (!member.ok) return ['不是该账本成员', null]
  if (!data.operatorId || String(old.userId) !== String(data.operatorId)) {
    return ['只能删除自己记的账单', null]
  }

  const findBill = await loadWriteBill(old.billId)
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
