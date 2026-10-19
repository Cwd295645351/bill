import type { Row, WhereBag } from '../../types/domain'
import { Transaction } from '../../database/index'
import { findBillById, saveBudget, sequelize } from '../../database/services/billService'
import dayjs from 'dayjs'
import { Op } from 'sequelize'

// 查询预算列表
export const getList = async (data: Row) => {
  data.date = Number(data.date)
  const findBill = await findBillById(data.billId)
  if (!findBill) return ['未找到账本', null]
  if (!findBill.users.find((item) => item.id === data.userId)) return ['该用户并未加入此账本', null]
  const res = findBill.budget.find((item) => item.date === data.date) || { totalBudget: 0, currCost: 0, details: [] }
  if (res) return [null, res]
  else return ['查询失败', null]
}

// 新增预算
export const addBudget = async (data: Row) => {
  data.money = Number(data.money)
  const findBill = await findBillById(data.billId)
  if (!findBill) return ['未找到账本', null]
  if (!findBill.users.find((item) => item.id === data.userId)) return ['该用户并未加入此账本', null]

  let budget = findBill.budget.find((item) => item.date === data.date)
  if (budget) {
    // 已存在年度预算
    const details = budget.details || []
    let budgetDetailItem = details.find((item) => item.costTypeId === data.costTypeId)
    if (budgetDetailItem) return ['已存在相关预算', null]
    budget.totalBudget = Number(budget.totalBudget || 0) + Number(data.money)
    budgetDetailItem = {
      costTypeId: data.costTypeId,
      costTypeName: findBill.costTypes.find((item) => item.id === data.costTypeId)!.name,
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
          costTypeName: findBill.costTypes.find((item) => item.id === data.costTypeId)!.name,
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
  const findBill = await findBillById(data.billId)
  if (!findBill) return ['未找到账本', null]
  if (!findBill.users.find((item) => item.id === data.userId)) return ['该用户并未加入此账本', null]
  let budget = findBill.budget.find((item) => item.date === data.date)
  if (!budget) return ['不存在该年度预算', null]
  // 查找预算明细
  let budgetDetailItem = (budget.details || []).find((item) => item.id === data.id)
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
  const findBill = await findBillById(data.billId)
  if (!findBill) return ['未找到账本', null]
  if (!findBill.users.find((item) => item.id === data.userId)) return ['该用户并未加入此账本', null]
  let budget = findBill.budget.find((item) => item.date === data.date)
  if (!budget) return ['不存在该年度预算', null]
  // 查找预算明细
  const budgetDetailItem = (budget.details || []).find((item) => item.id === data.id)
  if (!budgetDetailItem) return ['不存在相关预算', null]
  budget.totalBudget = Number(budget.totalBudget || 0) - Number(budgetDetailItem.budget || 0)
  budget.details = (budget.details || []).filter((item) => item.id !== data.id)
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
