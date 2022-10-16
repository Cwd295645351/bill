import Bill from '../../database/modules/Bills'
import mongoose from '../../database/index'
import { encode, decode } from '../../utils/cryp'
import * as InitData from '../../database/initDatas'

// 查询账本列表
export const getBillList = async ({ userId, nickName }) => {
  const params = { users: { $in: [{ id: userId, name: nickName }] }, isDel: false }
  const res = await Bill.find(params, { creator: 1, name: 1 })
  return [null, res]
}

// 创建账本
export const createBill = async ({ userId, name, nickName }) => {
  const findData = { name: name, creator: userId }
  const findBill = await Bill.findOne(findData, {})
  if (findBill) {
    return ['该名称的账本已存在', null]
  }
  const createData = {
    name: name,
    creator: userId,
    users: [{ id: userId, name: nickName }],
    costTypes: InitData.costTypes,
    incomesTypes: InitData.incomesTypes,
    payMethods: InitData.payMethods,
    planBuy: { count: 0, totalCost: 0, details: [] },
    budget: { totalBudget: 0, currCost: 0, details: [] },
    isDel: false
  }
  const billRes = await Bill.create(createData)
  if (!billRes) return ['创建失败', null]
  return [null, billRes._id]
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
  if (!billRes) return ['找不到该账本或您非该账本的创建者', null]
  return [null, true]
}

// 查询账本详情
export const getBillDetail = async ({ userId, id, nickName }) => {
  const params = { _id: mongoose.Types.ObjectId(id), users: { $in: [{ id: userId, name: nickName }] }, isDel: false }
  const filterData = {
    planBuy: 1,
    budget: 1,
    name: 1,
    users: 1,
    creator: 1,
    costTypes: 1,
    incomesTypes: 1,
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
export const joinBill = async ({ userId, code, nickName }) => {
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
    if (findBill.users.find((item) => item.id === userId)) return ['已加入该账本', null]
    findBill.users.push({ id: userId, name: nickName })
    const billRes = await Bill.findOneAndUpdate(params, { users: findBill.users })
    if (!billRes) return [('加入账本失败', null)]
    return [null, true]
  } catch (e) {
    console.log(e)
    return ['加入账本失败', null]
  }
}

// 退出账本
export const quitBill = async ({ userId, id, nickName }) => {
  // 从该账本中查找是否存在该用户，若存在则退出账本
  const billParams = { _id: mongoose.Types.ObjectId(id), isDel: false }

  const billRes = await Bill.findOne(billParams, { users: 1, creator: 1 })
  if (!billRes) return ['找不到该账本', null]
  if (!billRes.users.find((item) => item.id === userId)) return ['您并未加入该账本', null]
  if (billRes.creator === userId) return ['创建者不能退出账本', null]
  const billQuitRes = await Bill.findOneAndUpdate(billParams, { $pull: { users: { id: userId, name: nickName } } }, { new: true })
  if (!billQuitRes) return ['退出账本失败', null]
  return [null, true]
}

// 将某个移出账本
export const removePerson = async ({ userId, id, nickName }) => {
  // 从该账本中查找是否存在该用户，若存在则移除
  const billParams = { _id: mongoose.Types.ObjectId(id), isDel: false }

  const billRes = await Bill.findOne(billParams, { users: 1 })
  if (!billRes) return ['找不到该账本', null]
  if (!billRes.users.find((item) => item.id === userId)) return ['该用户并未加入此账本', null]
  const billQuitRes = await Bill.findOneAndUpdate(billParams, { $pull: { users: { id: userId, name: nickName } } }, { new: true })
  if (!billQuitRes) return ['移除失败', null]
  return [null, true]
}
