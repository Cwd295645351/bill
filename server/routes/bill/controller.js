import Bill from '../../database/modules/Bills'
import { xssData } from '../../utils/xss'
import * as InitData from '../../database/initDatas'

export const createBill = async (data) => {
  xssData(data)
  const findData = {
    name: data.name,
    creator: data.userId
  }
  const findBill = await Bill.findOne(findData, {})
  if (findBill) {
    return ['该名称的账单已存在', null]
  }
  const createData = {
    name: data.name,
    creator: data.userId,
    users: [data.userId],
    costTypes: InitData.costTypes,
    incomesType: InitData.incomesTypes,
    payMethods: InitData.payMethods,
    planBuy: { count: 0, totalCost: 0, details: [] },
    budget: { totalBudget: 0, currCost: 0, details: [] },
    isDel: false
  }
  try {
    const res = Bill.create(createData)
    if (res) return [null, true]
    else return ['创建失败', null]
  } catch (e) {
    return [e, null]
  }
}
