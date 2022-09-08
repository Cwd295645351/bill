import Bill from '../../database/modules/Bills'
import User from '../../database/modules/User'
import mongoose from '../../database/index'
import { encode, decode } from '../../utils/cryp'
import * as InitData from '../../database/initDatas'

// 创建账本
export const createBill = async ({ userId, name }) => {
  const findData = { name: name, creator: userId }
  const findBill = await Bill.findOne(findData, {})
  if (findBill) {
    return ['该名称的账本已存在', null]
  }
  const createData = {
    name: name,
    creator: userId,
    users: [userId],
    costTypes: InitData.costTypes,
    incomesType: InitData.incomesTypes,
    payMethods: InitData.payMethods,
    planBuy: { count: 0, totalCost: 0, details: [] },
    budget: { totalBudget: 0, currCost: 0, details: [] },
    isDel: false
  }
  const billRes = await Bill.create(createData)
  if (!billRes) return ['创建失败', null]

  // 创建账本成功，还需要从用户表增加对应账本id
  const billId = billRes._id.toString()
  const userParams = { _id: mongoose.Types.ObjectId(userId), isDel: false }
  const userRes = await User.findOneAndUpdate(userParams, { $addToSet: { bills: { id: billId, name: name } } }, { new: true })
  if (userRes) return [null, billRes._id]
  else return ['创建失败', null]
}

// 编辑账本名称
export const editBill = async ({ id, name }) => {
  const params = { _id: mongoose.Types.ObjectId(id) }
  const res = await Bill.findOneAndUpdate(params, { name: name }, { new: true })
  if (res) return [null, true]
  else return ['编辑失败', null]
}

// 删除账本
export const delBill = async ({ userId, id }) => {
  const params = { _id: mongoose.Types.ObjectId(id), creator: userId, isDel: false }
  const billRes = await Bill.findOneAndUpdate(params, { isDel: true }, { new: true })
  if (!billRes) return ['找不到该账本', null]

  // 删除账本成功，还需要从用户表删除对应账本id
  const userParams = { _id: mongoose.Types.ObjectId(userId), isDel: false }
  const userRes = await User.findOneAndUpdate(userParams, { $pull: { bills: { id: id } } }, { new: true })
  if (userRes) return [null, true]
  else return ['删除失败', null]
}

// 查询账本详情
export const getBillDetail = async ({ userId, id }) => {
  const params = { _id: mongoose.Types.ObjectId(id), users: { $in: [userId] }, isDel: false }
  const filterData = {
    planBuy: 1,
    budget: 1,
    name: 1,
    creator: 1,
    costTypes: 1,
    incomesType: 1,
    payMethods: 1
  }
  const res = await Bill.findOne(params, filterData)
  console.log(params, res)
  if (res) return [null, res]
  return ['找不到账本', null]
}

// 用公钥生成将id和有效时间生成密文
export const invite = async ({ userId, id }) => {
  // 查找该用户是否是账本的持有者
  const billParams = { _id: mongoose.Types.ObjectId(id), creator: userId, isDel: false }
  const billRes = await Bill.findOne(billParams, { users: 1 })
  if (!billRes) return ['找不到该账本', null]

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

// 加入某个账本
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

// 退出账本
export const quitBill = async ({ userId, id }) => {
  // 从该账本中查找是否存在该用户，若存在则退出账本
  const billParams = { _id: mongoose.Types.ObjectId(id), isDel: false }

  const billRes = await Bill.findOne(billParams, { users: 1, creator: 1 })
  if (!billRes) return ['找不到该账本', null]
  if (!billRes.users.includes(userId)) return ['您并未加入该账本', null]
  if (billRes.creator === userId) return ['创建者不能退出账本', null]
  const billQuitRes = await Bill.findOneAndUpdate(billParams, { $pull: { users: userId } }, { new: true })
  if (!billQuitRes) return ['退出账本失败', null]

  // 退出账本成功，还需要从用户表删除对应账本id
  const userParams = { _id: mongoose.Types.ObjectId(userId), isDel: false }
  const userRes = await User.findOneAndUpdate(userParams, { $pull: { bills: { id: id } } }, { new: true })
  if (userRes) return [null, true]
  else return ['退出失败', null]
}

// 将某个移出账本
export const removePerson = async ({ userId, id }) => {
  // 从该账本中查找是否存在该用户，若存在则移除
  const billParams = { _id: mongoose.Types.ObjectId(id), isDel: false }

  const billRes = await Bill.findOne(billParams, { users: 1 })
  if (!billRes) return ['找不到该账本', null]
  if (!billRes.users.includes(userId)) return ['该用户并未加入此账本', null]
  const billQuitRes = await Bill.findOneAndUpdate(billParams, { $pull: { users: userId } }, { new: true })
  if (!billQuitRes) return ['移除失败', null]

  // 移除成功，还需要从用户表删除对应账本id
  const userParams = { _id: mongoose.Types.ObjectId(userId), isDel: false }
  const userRes = await User.findOneAndUpdate(userParams, { $pull: { bills: { id: id } } }, { new: true })
  if (userRes) return [null, true]
  else return ['退出失败', null]
}
