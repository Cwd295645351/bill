import Bill from '../../database/modules/Bills'
import { xssData } from '../../utils/xss'
import mongoose from '../../database/index'
import * as InitData from '../../database/initDatas'

// 创建账本
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
    console.log(e)
    return ['系统异常,请稍后再试', null]
  }
}

// 编辑账本名称
export const editBill = async (data) => {
  xssData(data)
  try {
    const params = {
      _id: mongoose.Types.ObjectId(data.id)
    }
    const res = await Bill.findOneAndUpdate(
      params,
      {
        name: data.name
      },
      { new: true }
    )
    if (res) return [null, true]
    else return ['编辑失败', null]
  } catch (e) {
    console.log(e)
    return ['系统异常,请稍后再试', null]
  }
}

// 删除账本
export const delBill = async (data) => {
  xssData(data)
  try {
    const params = {
      _id: mongoose.Types.ObjectId(data.id),
      isDel: false
    }
    const res = await Bill.findOneAndUpdate(
      params,
      {
        isDel: true
      },
      { new: true }
    )
    if (res) return [null, true]
    else return ['找不到该账单', null]
  } catch (e) {
    console.log(e)
    return ['系统异常,请稍后再试', null]
  }
}
