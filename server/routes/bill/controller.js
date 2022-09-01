import Bill from '../../database/modules/Bills'
import User from '../../database/modules/User'
import mongoose from '../../database/index'
import { xssData } from '../../utils/xss'
import { encode, decode } from '../../utils/cryp'
import * as InitData from '../../database/initDatas'

// 创建账本
export const createBill = async (data) => {
  xssData(data)
  const findData = { name: data.name, creator: data.userId }
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
    const billRes = await Bill.create(createData)
    if (!billRes) return ['创建失败', null]

    // 创建账本成功，还需要从用户表增加对应账本id
    const billId = billRes._id.toString()
    const userParams = { _id: mongoose.Types.ObjectId(data.userId), isDel: false }
    const userRes = await User.findOneAndUpdate(userParams, { $addToSet: { bills: { id: billId, name: data.name } } }, { new: true })
    if (userRes) return [null, true]
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
    const params = { _id: mongoose.Types.ObjectId(data.id) }
    const res = await Bill.findOneAndUpdate(params, { name: data.name }, { new: true })
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
    const params = { _id: mongoose.Types.ObjectId(data.id), isDel: false }
    const Billres = await Bill.findOneAndUpdate(params, { isDel: true }, { new: true })
    if (!Billres) return ['找不到该账单', null]

    // 删除账本成功，还需要从用户表删除对应账本id
    const userParams = { _id: mongoose.Types.ObjectId(data.userId), isDel: false }
    const userRes = await User.findOneAndUpdate(userParams, { $pull: { bills: { id: data.id } } }, { new: true })
    if (userRes) return [null, true]
    else return ['删除失败', null]
  } catch (e) {
    console.log(e)
    return ['系统异常,请稍后再试', null]
  }
}

// 用公钥生成将id和有效时间生成密文
export const invite = async ({ id }) => {
  const date = Number(new Date().getTime()) + 30 * 60 * 1000 // 过期时间
  const key = `${id}&${date}`
  try {
    const sign = encode(key)
    return [null, sign]
  } catch (e) {
    console.log(e)
    return ['生成邀请码失败', null]
  }
}

//
export const joinBill = async ({ userId, code }) => {
  let billId = ''
  try {
    const sign = decode(code)
    const keys = sign.split('&')
    const expiredTime = keys[1]
    billId = keys[0]
    // 邀请码过期
    if (new Date().getTime() > expiredTime) return ['邀请码已失效', null]
  } catch (e) {
    console.log(e)
    return ['密钥不正确', null]
  }
  try {
    // 查找账本是否存在，并判断是否已加入该账本
    const params = { _id: mongoose.Types.ObjectId(billId), isDel: false }
    const findBill = await Bill.findOne(params, {})
    if (!findBill) return ['该账本不存在', null]
    if (findBill.users.includes(userId)) return ['已加入该账本', null]
    const billRes = await Bill.findOneAndUpdate(params, { users: [...findBill.users, userId] })
    if (!billRes) return [('加入账本失败', null)]

    // 加入账本成功后，把账本加入用户表中
    const userParams = { _id: mongoose.Types.ObjectId(userId), isDel: false }
    const userRes = await User.findOneAndUpdate(userParams, { $addToSet: { bills: { id: billId, name: findBill.name } } }, { new: true })
    if (userRes) return [null, true]
    else return ['加入账本失败', null]
  } catch (e) {
    console.log(e)
    return ['加入账本失败', null]
  }
}
